import assert from 'node:assert/strict';
import {
  buildSolvedCubeState,
  buildCubeState,
  validateCubeState,
  auditStandardMoveGeometry,
  auditCubeEngine,
  stateToFaceletString,
} from '../js/cube-engine.js';

const expected = {
  "R": "UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB",
  "R'": "UUBUUBUUBRRRRRRRRRFFUFFUFFUDDFDDFDDFLLLLLLLLLDBBDBBDBB",
  "R2": "UUDUUDUUDRRRRRRRRRFFBFFBFFBDDUDDUDDULLLLLLLLLFBBFBBFBB",
  "U": "UUUUUUUUUBBBRRRRRRRRRFFFFFFDDDDDDDDDFFFLLLLLLLLLBBBBBB",
  "U'": "UUUUUUUUUFFFRRRRRRLLLFFFFFFDDDDDDDDDBBBLLLLLLRRRBBBBBB",
  "U2": "UUUUUUUUULLLRRRRRRBBBFFFFFFDDDDDDDDDRRRLLLLLLFFFBBBBBB",
  "F": "UUUUUULLLURRURRURRFFFFFFFFFRRRDDDDDDLLDLLDLLDBBBBBBBBB",
  "F'": "UUUUUURRRDRRDRRDRRFFFFFFFFFLLLDDDDDDLLULLULLUBBBBBBBBB",
  "F2": "UUUUUUDDDLRRLRRLRRFFFFFFFFFUUUDDDDDDLLRLLRLLRBBBBBBBBB",
  "D": "UUUUUUUUURRRRRRFFFFFFFFFLLLDDDDDDDDDLLLLLLBBBBBBBBBRRR",
  "D'": "UUUUUUUUURRRRRRBBBFFFFFFRRRDDDDDDDDDLLLLLLFFFBBBBBBLLL",
  "D2": "UUUUUUUUURRRRRRLLLFFFFFFBBBDDDDDDDDDLLLLLLRRRBBBBBBFFF",
  "L": "BUUBUUBUURRRRRRRRRUFFUFFUFFFDDFDDFDDLLLLLLLLLBBDBBDBBD",
  "L'": "FUUFUUFUURRRRRRRRRDFFDFFDFFBDDBDDBDDLLLLLLLLLBBUBBUBBU",
  "L2": "DUUDUUDUURRRRRRRRRBFFBFFBFFUDDUDDUDDLLLLLLLLLBBFBBFBBF",
  "B": "RRRUUUUUURRDRRDRRDFFFFFFFFFDDDDDDLLLULLULLULLBBBBBBBBB",
  "B'": "LLLUUUUUURRURRURRUFFFFFFFFFDDDDDDRRRDLLDLLDLLBBBBBBBBB",
  "B2": "DDDUUUUUURRLRRLRRLFFFFFFFFFDDDDDDUUURLLRLLRLLBBBBBBBBB",
  "R2 D2 R2 U'": "DDDUUUUUUFFFRRRRRRLLLFFFFBFUDDUDDUDDBBBLLLRRRLLLBBBBFB",
  "U' R U B'": "LLLUUUFFLURURRURRURRFFFDFFDDDBDDBFFRDLDDLLRLLBBBBBBBUU",
  "R' B R'": "RRBUUBUUDFDDRRRRRRFFRFFBFFBDDUDDULLUBLLULLULLLDDFBBFBB",
};

for (const size of [2, 3]) {
  assert.equal(validateCubeState(size, buildSolvedCubeState(size)), true, `solved ${size}x${size}`);
  assert.equal(auditStandardMoveGeometry(size), true, `move geometry ${size}x${size}`);
}

for (const [alg, facelets] of Object.entries(expected)) {
  const state = buildCubeState(3, alg);
  assert.equal(validateCubeState(3, state), true, `valid state: ${alg}`);
  const colors = stateToFaceletString(state, 3).replaceAll('W','U').replaceAll('G','F').replaceAll('Y','D').replaceAll('O','L');
  assert.equal(colors, facelets, `facelets: ${alg}`);
  assert.equal(auditCubeEngine(3, alg), true, `inverse audit: ${alg}`);
}

for (const face of ['R','L','U','D','F','B']) {
  assert.equal(
    stateToFaceletString(buildCubeState(3, `${face} ${face}`), 3),
    stateToFaceletString(buildCubeState(3, `${face}2`), 3),
    `${face}2 equals two quarter turns`,
  );
  assert.equal(
    stateToFaceletString(buildCubeState(3, `${face} ${face} ${face} ${face}`), 3),
    stateToFaceletString(buildSolvedCubeState(3), 3),
    `${face} repeated four times returns solved`,
  );
}

console.log('CubeClash v49 cube-engine audit: PASS');
