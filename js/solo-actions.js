export function bindSolveDeleteButtons(root = document, options = {}) {
  const {
    deleteSolve,
    getSolves,
    toast,
    solo,
    s,
    confirmFn = (message) => {
      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        return window.confirm(message);
      }
      return true;
    },
  } = options;

  if (!root || typeof root.querySelectorAll !== "function") return;

  const buttons = root.querySelectorAll("[data-delete-solve]");
  buttons.forEach((btn) => {
    btn.onclick = async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      const id = btn.dataset?.deleteSolve;
      if (!id || typeof deleteSolve !== "function") return;
      if (!confirmFn("Delete this solve? This cannot be undone unless you exported it.")) return;

      try {
        await deleteSolve(id);

        if (typeof getSolves === "function") {
          const all = await getSolves();
          if (s && Array.isArray(all)) {
            const latest = all.find((x) => x.puzzle === s.puzzle);
            s.last = latest ? { display: latest.display } : null;
          }
        }

        toast?.("SOLVE DELETED");
        if (typeof solo === "function") await solo();
      } catch (err) {
        console.error(err);
        toast?.("DELETE FAILED");
      }
    };
  });
}
