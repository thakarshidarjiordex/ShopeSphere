import { useGetAllOrdersQuery, useUpdateOrderStatusMutation } from "../services/ordersApi";
import type { MyOrder, OrderStatus } from "../services/ordersApi";
import "./AdminOrders.css";

const statuses: OrderStatus[] = [
  "placed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

function formatPrice(amount: number) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminOrders() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllOrdersQuery();

  const [updateOrderStatus, { isLoading: isUpdating }] =
    useUpdateOrderStatusMutation();

  async function handleStatusChange(
    order: MyOrder,
    status: OrderStatus
  ) {
    if (status === order.status) return;

    try {
      await updateOrderStatus({
        id: order._id,
        status,
      }).unwrap();

      alert("Order status updated successfully!");
    } catch (err) {
      console.error("Failed to update order status:", err);
      alert("Could not update the order status. Please try again.");
    }
  }

  if (isLoading) {
    return <section className="admin-orders"><p>Loading orders...</p></section>;
  }

  if (isError) {
    return (
      <section className="admin-orders">
        <h2>Admin Order Management</h2>
        <p>Unable to load orders. Check your admin login and backend.</p>
        <button onClick={() => refetch()}>Try Again</button>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </section>
    );
  }

  const orders = data?.data ?? [];

  return (
    <section className="admin-orders">
      <div className="admin-orders-heading">
        <div>
          <h2>Admin Order Management</h2>
          <p>View customer orders and update their status.</p>
        </div>
        <button onClick={() => refetch()}>Refresh</button>
      </div>

      <p className="admin-orders-count">
        Total orders: <strong>{orders.length}</strong>
      </p>

      {orders.length === 0 ? (
        <p>No orders have been placed yet.</p>
      ) : (
        <div className="admin-orders-table-wrapper">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Update status</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>#{order._id.slice(-8).toUpperCase()}</td>

                  <td>
                    <strong>{order.customer.name}</strong>
                    <br />
                    <small>{order.customer.email}</small>
                  </td>

                  <td>{formatDate(order.createdAt)}</td>

                  <td>{formatPrice(order.totalAmount)}</td>

                  <td>
                    <span className={`admin-order-status status-${order.status}`}>
                      {order.status}
                    </span>
                  </td>

                  <td>
                    <select
                      value={order.status}
                      disabled={isUpdating}
                      aria-label={`Update status for order ${order._id}`}
                      onChange={(event) =>
                        handleStatusChange(
                          order,
                          event.target.value as OrderStatus
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
