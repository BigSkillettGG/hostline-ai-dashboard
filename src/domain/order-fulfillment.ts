import type { Order, OrderDeliveryDestination, OrderStatus } from "@/data/mock";

export const activeKitchenStatuses: OrderStatus[] = ["new", "accepted", "in_progress"];

const kitchenStatusRank: Record<OrderStatus, number> = {
  in_progress: 0,
  new: 1,
  accepted: 2,
  completed: 3,
  canceled: 4,
};

export function isActiveKitchenOrder(order: Order) {
  return activeKitchenStatuses.includes(order.status);
}

export function getNextKitchenStatus(status: OrderStatus): OrderStatus | undefined {
  if (status === "new") return "accepted";
  if (status === "accepted") return "in_progress";
  if (status === "in_progress") return "completed";
  return undefined;
}

export function getKitchenActionLabel(status: OrderStatus) {
  if (status === "new") return "Accept ticket";
  if (status === "accepted") return "Start prep";
  if (status === "in_progress") return "Mark ready";
  return "Done";
}

export function orderItemCount(order: Pick<Order, "items">) {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

export function orderAgeMinutes(order: Pick<Order, "createdAt">, now = new Date()) {
  const createdAt = new Date(order.createdAt).getTime();
  if (Number.isNaN(createdAt)) return 0;
  return Math.max(0, Math.floor((now.getTime() - createdAt) / 60_000));
}

export function hasSentDeliveryAttempt(order: Pick<Order, "deliveryAttempts">, destination: OrderDeliveryDestination) {
  return (order.deliveryAttempts ?? []).some(
    (attempt) => attempt.destination === destination && attempt.status === "sent",
  );
}

export function buildKitchenDeliveryPayload(order: Order, action: string) {
  return {
    action,
    itemCount: orderItemCount(order),
    orderStatus: order.status,
    source: "kitchen_tablet",
    total: order.total,
  };
}

export function sortKitchenTickets(first: Order, second: Order) {
  const rankDiff = kitchenStatusRank[first.status] - kitchenStatusRank[second.status];
  if (rankDiff !== 0) return rankDiff;

  return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
}
