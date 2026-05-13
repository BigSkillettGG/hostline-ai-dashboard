import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAgentTestTools,
  generateAgentTestReply,
  handleAgentTestToolCall,
  type AgentTestAction,
} from "./agent-test";
import { demoRestaurantContext } from "./restaurant-context";

const env = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
};

describe("agent test reply", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a message", async () => {
    await expect(
      generateAgentTestReply({
        context: demoRestaurantContext,
        env,
        input: {
          message: " ",
        },
      }),
    ).rejects.toThrow("message is required");
  });

  it("uses safe simulated tools for phone scenario testing", async () => {
    const actions: AgentTestAction[] = [];

    const result = await handleAgentTestToolCall({
      actions,
      channel: "phone",
      context: demoRestaurantContext,
      toolCall: {
        arguments: {
          link_kind: "reservation",
        },
        callId: "tool_1",
        name: "send_business_link",
      },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(actions).toEqual([
      {
        link: demoRestaurantContext.businessLinks[1],
        type: "business_link",
      },
    ]);
  });

  it("lets the model exercise tools without creating live side effects", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: [
              {
                arguments: "{\"link_kind\":\"reservation\"}",
                call_id: "tool_1",
                name: "send_business_link",
                type: "function_call",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: "I texted you the reservation link. Anything else I can help with?" }), {
          status: 200,
        }),
      );

    const result = await generateAgentTestReply({
      context: demoRestaurantContext,
      env,
      input: {
        channel: "phone",
        message: "Can you text me the reservation link?",
        scenarioId: "restaurant-reservation-link",
      },
    });

    expect(result.reply).toContain("reservation link");
    expect(result.actions).toEqual([
      {
        link: demoRestaurantContext.businessLinks[1],
        type: "business_link",
      },
    ]);
    expect(result.transcript.at(-1)?.role).toBe("assistant");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstBody.instructions).toContain("Scenario Lab live phone simulation");
    expect(firstBody.instructions).toContain("Scenario Lab case id: restaurant-reservation-link");
    expect(firstBody.tools.map((tool: { name: string }) => tool.name)).toContain("send_business_link");
  });

  it("uses chat-specific link tools for website chat scenarios", () => {
    const tools = buildAgentTestTools(demoRestaurantContext, "website_chat");

    expect(tools.map((tool) => tool.name)).toContain("get_business_link");
    expect(tools.map((tool) => tool.name)).not.toContain("finish_call");
  });
});
