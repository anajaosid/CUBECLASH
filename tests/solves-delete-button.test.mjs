import assert from 'node:assert/strict';
import test from 'node:test';
import { bindSolveDeleteButtons } from '../js/solo-actions.js';

test('bindSolveDeleteButtons deletes the selected solve and refreshes the solo state', async () => {
  let deletedId = null;
  let toastMessage = null;
  let soloCalled = false;
  const state = { puzzle: '333', last: null };
  const button = { dataset: { deleteSolve: 'abc-123' } };
  const root = { querySelectorAll: () => [button] };

  bindSolveDeleteButtons(root, {
    deleteSolve: async (id) => {
      deletedId = id;
    },
    getSolves: async () => [{ id: 'zzz-555', puzzle: '333', display: '12.34' }],
    toast: (message) => {
      toastMessage = message;
    },
    solo: async () => {
      soloCalled = true;
    },
    s: state,
    confirmFn: () => true,
  });

  assert.equal(typeof button.onclick, 'function');

  await button.onclick({
    preventDefault() {},
    stopPropagation() {},
  });

  assert.equal(deletedId, 'abc-123');
  assert.equal(state.last.display, '12.34');
  assert.equal(toastMessage, 'SOLVE DELETED');
  assert.equal(soloCalled, true);
});
