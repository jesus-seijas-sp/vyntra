// The total of a cart: prices in cents, and a discount in percent.
module.exports.total = (items, discount = 0) => {
  const sum = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  return Math.round(sum - sum * (discount / 10));
};
