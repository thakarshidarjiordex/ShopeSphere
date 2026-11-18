import { useGetMyOrdersQuery } from "../services/ordersApi";
import type {
  MyOrder,
  OrderStatus,
} from "../services/ordersApi";
import "./MyOrders.css";

function formatDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

const trackingSteps: {
  status: Exclude<OrderStatus, "cancelled">;
  title: string;
  description: string;
}[] = [
  {
    status: "placed",
    title: "Order Placed",
    description: "We have received your order.",
  },
  {
    status: "processing",
    title: "Processing",
    description: "Your order is being prepared.",
  },
  {
    status: "shipped",
    title: "Shipped",
    description: "Your order is on its way.",
  },
  {
    status: "delivered",
    title: "Delivered",
    description: "Your order has been delivered.",
  },
];

function formatStatus(status: OrderStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function OrderTracking({ order }: { order: MyOrder }) {
  const history = order.statusHistory ?? [];
  const isCancelled = order.status === "cancelled";

  const historyByStatus = new Map(
    history.map((entry) => [entry.status, entry])
  );

  return (
    <section className="order-tracking">
      <div className="tracking-heading">
        <div>
          <h4>Track Your Order</h4>
          <p>Follow the progress of your purchase.</p>
        </div>

        <span
          className={`tracking-current-status status-${order.status}`}
        >
          {formatStatus(order.status)}
        </span>
      </div>

      {isCancelled ? (
        <div className="tracking-cancelled">
          <span className="tracking-cancelled-icon">!</span>
          <div>
            <strong>Order Cancelled</strong>
            <p>
              {historyByStatus.get("cancelled")?.note ??
                "This order has been cancelled."}
            </p>

            {historyByStatus.get("cancelled") && (
              <small>
                {formatDateTime(
                  historyByStatus.get("cancelled")!.changedAt
                )}
              </small>
            )}
          </div>
        </div>
      ) : (
        <ol className="tracking-timeline">
          {trackingSteps.map((step, index) => {
            const historyEntry = historyByStatus.get(step.status);
            const completed = Boolean(historyEntry);

            return (
              <li
                key={step.status}
                className={`tracking-step ${
                  completed ? "completed" : ""
                } ${order.status === step.status ? "current" : ""}`}
              >
                <div className="tracking-marker">
                  {completed ? "✓" : index + 1}
                </div>

                <div className="tracking-step-content">
                  <strong>{step.title}</strong>

                  <p>
                    {historyEntry?.note ?? step.description}
                  </p>

                  {historyEntry ? (
                    <time dateTime={historyEntry.changedAt}>
                      {formatDateTime(historyEntry.changedAt)}
                    </time>
                  ) : (
                    <small className="tracking-pending">
                      {order.status === "placed" &&
                      step.status === "placed"
                        ? "Waiting for tracking history"
                        : "Not completed yet"}
                    </small>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {history.length === 0 && (
        <p className="tracking-history-notice">
          Tracking history is not available for this older order.
          New orders will record status updates as they happen.
        </p>
      )}
    </section>
  );
}

function OrderCard({ order }: { order: MyOrder }) {
  return (
    <article className="my-order-card">
      <div className="my-order-header">
        <div>
          <h3>Order #{order._id.slice(-8).toUpperCase()}</h3>
          <p className="my-order-date">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>

        <span className={`order-status status-${order.status}`}>
          {formatStatus(order.status)}
        </span>
      </div>

      <div className="my-order-items">
        {order.items.map((item, index) => (
          <div
            className="my-order-item"
            key={`${order._id}-${item.product}-${index}`}
          >
            {item.image ? (
              <img
                className="my-order-image"
                src={item.image}
                alt={item.name}
              />
            ) : (
              <div className="my-order-image image-placeholder">
                No image
              </div>
            )}

            <div className="my-order-item-details">
              <h4>{item.name}</h4>
              <p>Quantity: {item.quantity}</p>
              <p>Price: {formatPrice(item.price)}</p>
            </div>

            <strong>
              {formatPrice(item.price * item.quantity)}
            </strong>
          </div>
        ))}
      </div>

      <OrderTracking order={order} />

      <div className="my-order-footer">
        <div>
          <strong>Shipping address</strong>
          <p>
            {order.shippingAddress.street},{" "}
            {order.shippingAddress.city},{" "}
            {order.shippingAddress.state}{" "}
            {order.shippingAddress.postalCode},{" "}
            {order.shippingAddress.country}
          </p>
        </div>

        <div className="my-order-total">
          <span>Total</span>
          <strong>{formatPrice(order.totalAmount)}</strong>
        </div>
      </div>
    </article>
  );
}

export default function MyOrders() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetMyOrdersQuery();

  if (isLoading) {
    return (
      <section className="my-orders-page">
        <h2>My Orders</h2>
        <p>Loading your orders...</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="my-orders-page">
        <h2>My Orders</h2>
        <p className="orders-error">
          Could not load your orders. Please check that you are logged
          in and the backend server is running.
        </p>

        <button onClick={() => refetch()}>Try Again</button>

        <details>
          <summary>Technical details</summary>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </details>
      </section>
    );
  }

  const orders = data?.data ?? [];

  return (
    <section className="my-orders-page">
      <div className="my-orders-title">
        <div>
          <h2>My Orders</h2>
          <p>View your purchases and track their progress.</p>
        </div>

        <button onClick={() => refetch()}>Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-orders">
          <h3>No orders yet</h3>
          <p>Your orders will appear here after you complete checkout.</p>
        </div>
      ) : (
        <>
          <p className="orders-count">
            You have {orders.length} order
            {orders.length !== 1 ? "s" : ""}.
          </p>

          <div className="my-orders-list">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
