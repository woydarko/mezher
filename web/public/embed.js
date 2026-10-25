// Mezher checkout button for any website. Usage:
// <script src="https://mezher.vercel.app/embed.js" data-to="0x…" data-amount="12" data-order="3f9a1c0d2b4e5f60" data-label="Coffee" async></script>
// Renders a link that opens the Mezher checkout in a new tab; /pay validates every field again.
(function () {
  var script = document.currentScript;
  if (!script) return;
  var d = script.dataset;
  if (!d.to || !d.amount || !d.order) {
    console.warn("Mezher embed: data-to, data-amount and data-order are required.");
    return;
  }

  var params = new URLSearchParams({ to: d.to, amount: d.amount, order: d.order });
  if (d.label) params.set("label", d.label);

  var a = document.createElement("a");
  a.href = new URL("/pay?" + params.toString(), script.src).toString();
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Pay " + d.amount + " MUSD with Bitcoin";
  a.setAttribute("style", [
    "display:inline-block",
    "padding:10px 18px",
    "background:#f7931a",
    "color:#1f1b16",
    "border:2px solid #1f1b16",
    "border-radius:255px 18px 225px 18px / 18px 225px 18px 255px",
    "font:600 16px/1.2 system-ui, sans-serif",
    "text-decoration:none",
    "box-shadow:3px 3px 0 #1f1b16",
  ].join(";"));
  script.insertAdjacentElement("afterend", a);
})();
