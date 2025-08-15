let points = [];
let approximationTrees = [];
const colours = ["Purple", "lightGreen", "lightBlue", "Orange"];
const colourLetters = [
  ["P", "Purple"],
  ["G", "lightGreen"],
  ["B", "lightBlue"],
  ["O", "Orange"],
];
let letterColorPairs = [];
let sequenceOfPos = [];
let currentSequencePos = 0;
let startTime;
let displayDuration = 1500;
const tolerance = 1e-5;

function setup() {
  createCanvas(windowWidth - 4, windowHeight - 4);

  fill("black");
  textSize(40);
  const choice = Math.floor(random(4));
  letterColorPairs = [colourLetters[choice]];
  sequenceOfPos = [choice];

  const spacer = 10;
  const cBXStart = 30;
  const buttonsHeight = 65;
  const replayButton = createButton("Reset");
  replayButton.position(cBXStart, buttonsHeight);
  replayButton.mousePressed(setup);

  // below was generated with Deepseek R1
  const midX = Math.floor(windowWidth / 2);
  const midY = Math.floor(windowHeight / 2);
  const quadrants = [
    { minX: midX, maxX: windowWidth - 1, minY: 100, maxY: midY - 1 },
    { minX: 10, maxX: midX - 1, minY: 100, maxY: midY - 1 },
    { minX: 10, maxX: midX - 1, minY: midY, maxY: windowHeight - 10 },
    { minX: midX, maxX: windowWidth - 10, minY: midY, maxY: windowHeight - 10 },
  ];

  points = generatePolygonsIn(quadrants);

  startTime = millis();
}

function generatePolygonsIn(quadrants) {
  const polygons = [];
  for (const q of quadrants) {
    const numPoints = Math.floor(Math.random() * 11) + 5;
    points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push(
        new Point(
          Math.floor(Math.random() * (q.maxX - q.minX + 1)) + q.minX,
          Math.floor(Math.random() * (q.maxY - q.minY + 1)) + q.minY
        )
      );
    }

    let hull = performGrahamScan(performGrahamScan(points)); // I must have made a mistake somewhere, as I sometimes need it twice to make sure it works :-/

    if (hull.length < 3) {
      hull = [
        { x: q.minX, y: q.minY },
        { x: q.minX, y: q.minY + Math.min(10, q.maxY - q.minY) },
        { x: q.minX + Math.min(10, q.maxX - q.minX), y: q.minY },
      ];
    }

    polygons.push(hull);
    approximationTrees.push(createTriangleTree(hull));
  }
  return polygons;
}

class Point {
  constructor(x, y, label = "") {
    this.x = x;
    this.y = y;
    this.label = label;
  }

  isEqual(other) {
    return (
      Math.abs(this.x - other.x) < tolerance &&
      Math.abs(this.y - other.y) < tolerance
    );
  }

  toString() {
    return this.x + "," + this.y;
  }

  lt(minimal, otherPoint) {
    //print("InLt");
    return calculateDeterminant([minimal, otherPoint, this]) > 0;
  }
}

class Triangle {
  constructor(p1, p2, p3) {
    this._points = [p1, p2, p3];
    this._key = this._points
      .map((p) => p.toString())
      .sort()
      .join(";");
  }

  isEqual(other) {
    return this._key === other.key;
  }

  getKey() {
    return this._key;
  }

  toString() {
    return this.getKey();
  }

  getArea() {
    const crossProduct = calculateDeterminant(this._points);
    return Math.abs(crossProduct) / 2;
  }
}

class TriangleNode {
  constructor(edge) {
    this.edge = edge;
    this.left = null;
    this.right = null;
  }

  isVertex() {
    return this.edge[0] === null || this.edge[1] === null;
  }

  getVertex() {
    return this.edge[1] === null ? this.edge[0] : this.edge[1];
  }

  contains(point) {
    try {
      let res;
      const onLeft = isLeftTurn(this.edge[0], this.edge[1], point);
      if (onLeft) {
        res = inTriangle(
          [this.edge[0], this.edge[1], this.left.getVertex()],
          point
        );
        if (!res) {
          res = this.left.contains(point);
        }
      } else {
        res = inTriangle(
          [this.edge[0], this.edge[1], this.right.getVertex()],
          point
        );
        if (!res) {
          res = this.right.contains(point);
        }
      }
      return res;
    } catch (e) {
      return false;
    }
  }
}

function createTriangleTree(polygon) {
  const S1 = [polygon[0], splitPolygon(polygon)];
  let root = new TriangleNode(S1);

  root.right = createNode(S1, polygon);
  root.left = createNode([S1[1], S1[0]], polygon);

  return root;
}

function createNode(pJpJ1, polygon) {
  let res = null;
  const p = pJpJ1[0];
  const pNext = pJpJ1[1];
  const tPIndex = tangentComplementIndex(polygon, p, false);
  const tPNextIndex = tangentComplementIndex(polygon, pNext, true);
  const tP = polygon[tPIndex];
  const tPNext = polygon[tPNextIndex];
  const inter = lineIntersection([p, tP], [pNext, tPNext]);

  if (tP.isEqual(tPNext)) {
    res = new TriangleNode([tP, null]);
  } else {
    res = splitTriangle(inter, polygon, p, pNext, tPIndex, tPNextIndex, res);
  }

  return res;
}

function splitTriangle(inter, polygon, p, pNext, tPIndex, tPNextIndex, res) {
  if (inter !== null && !inPolygon(polygon, inter)) {
    const mustAccept = isLeftTurn(p, pNext, inter);
    const pHalf = splitPolygon([inter, pNext, p]);
    let onBondary = null;
    let j = tPIndex;
    while (onBondary === null && j <= tPNextIndex) {
      let edge = [polygon[j], polygon[(j + 1) % polygon.length]];
      onBondary = edgeIntersection(edge, [inter, pHalf], mustAccept);
      j++;
    }

    res = new TriangleNode([pHalf, onBondary]);
    if (!res.isVertex()) {
      res.right = createNode([p, onBondary], polygon);
      res.left = createNode([onBondary, pNext], polygon);
    }
  }
  return res;
}

function splitPolygon(polygon, startingPoint = null) {
  const fixedPoint = startingPoint != null ? startingPoint : polygon[0];

  const [cumulative, opEdge, totalArea] = oppositeEdge(polygon, fixedPoint);

  return interpolate(fixedPoint, opEdge[0], opEdge[1], totalArea, cumulative);
}

// this was generated with Deepseek R1
function interpolate(fixedPoint, edgeStart, edgeEnd, totalArea, cumulative) {
  const area_current = new Triangle(fixedPoint, edgeStart, edgeEnd).getArea();

  const remaining = totalArea / 2 - (cumulative - area_current);

  let surfaceRatio = area_current < 1e-12 ? 0 : remaining / area_current;
  surfaceRatio = Math.max(0, Math.min(1, surfaceRatio));

  const sEX = edgeEnd.x - edgeStart.x;
  const sEY = edgeEnd.y - edgeStart.y;

  return new Point(
    edgeStart.x + surfaceRatio * sEX,
    edgeStart.y + surfaceRatio * sEY
  );
}

function oppositeEdge(polygon, startingPoint = null) {
  const fixedPoint = startingPoint != null ? startingPoint : polygon[0];
  let res = [polygon[polygon.length - 2], polygon[polygon.length - 1]];
  let { totalArea, areaMap } = areasInFrom(polygon, fixedPoint);

  const halfTotal = totalArea / 2;
  let cumulative = 0;
  let i = 1;
  let found = false;
  while (i <= areaMap.size && !found) {
    let currentTriangle = new Triangle(fixedPoint, polygon[i], polygon[i + 1]);
    cumulative += areaMap.get(currentTriangle.getKey());
    if (cumulative >= halfTotal) {
      res = [polygon[i], polygon[i + 1]];
      found = true;
    }
    i++;
  }

  return [cumulative, res, totalArea]; // Cumulative is up to the start of the edge
}

function areasInFrom(polygon, startingPoint = null) {
  const n = polygon.length;
  const fixedPoint = startingPoint != null ? startingPoint : polygon[0];
  let totalArea = 0;
  const areaMap = new Map();
  for (let i = 1; i < n - 1; i++) {
    const triangle = new Triangle(fixedPoint, polygon[i], polygon[i + 1]);
    let area = triangle.getArea();
    areaMap.set(triangle.getKey(), area);
    totalArea += area;
  }
  return { totalArea, areaMap };
}

function isRightTurn(p1, p2, p3) {
  // TODO has to change if change of Y direction referential
  return calculateDeterminant([p1, p2, p3]) > 0;
}

function isLeftTurn(p1, p2, p3) {
  // TODO has to change if change of Y direction referential
  return calculateDeterminant([p1, p2, p3]) < 0;
}

function inTriangle(triangle, point) {
  const [at, bt, ct] = triangle;
  const dt = point;

  const detABD = calculateDeterminant([at, bt, dt]);
  const detBCD = calculateDeterminant([bt, ct, dt]);
  const detCAD = calculateDeterminant([ct, at, dt]);

  return (
    (detABD >= 0 && detBCD >= 0 && detCAD >= 0) ||
    (detABD <= 0 && detBCD <= 0 && detCAD <= 0)
  );
}

// O(n), so already destroys the complexity -_-
// this was partly generated by Deepseek R1
function tangentComplementIndex(polygon, x, takeBefore = true) {
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    if (polygon[i].isEqual(x)) {
      let direction = takeBefore ? -1 : 1;
      return (i + direction + n) % n;
    }
  }

  for (let i = 0; i < n; i++) {
    const A = polygon[i];
    const B = polygon[(i + 1) % n];

    const det = calculateDeterminant([A, B, x]);
    const isAligned = -tolerance < det && det < tolerance;

    if (isAligned) return takeBefore ? i : (i + 1) % n; // Interior point -> return next vertex
  }

  throw new Error("Point not on polygon boundary");
}
// this was generated with Deepseek R1
function lineIntersection(edge1, edge2) {
  const [A, B] = edge1;
  const [C, D] = edge2;

  const a1 = B.y - A.y;
  const b1 = A.x - B.x;
  const c1 = a1 * A.x + b1 * A.y;

  const a2 = D.y - C.y;
  const b2 = C.x - D.x;
  const c2 = a2 * C.x + b2 * C.y;

  const det = a1 * b2 - a2 * b1;

  // Parallel lines
  if (Math.abs(det) < tolerance * tolerance) {
    return null;
  }

  const x = (b2 * c1 - b1 * c2) / det;
  const y = (a1 * c2 - a2 * c1) / det;

  return new Point(x, y);
}

// this destroys the algorithm's complexity as it makes it O(n). Would need those O(log n) algorithm to make it worthwhile :-/
function inPolygon(polygon, point) {
  let res = true;
  for (let i = 0; i < polygon.length; i++) {
    const fst = polygon[i];
    const snd = polygon[(i + 1) % polygon.length];

    res &= isLeftTurn(fst, snd, point);
  }
  return res;
}

// this was generated with Deepseek R1
function edgeIntersection(edge1, edge2, mustAccept) {
  const [p1, p2] = edge1;
  const [p3, p4] = edge2;

  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const det = dx1 * dy2 - dx2 * dy1;

  if (Math.abs(det) < tolerance * tolerance) {
    return null; // No intersection (parallel lines)
  }

  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / det;
  const u = -((p1.x - p3.x) * dy1 - (p1.y - p3.y) * dx1) / det;

  if (mustAccept || (t >= 0 && t <= 1 && u >= 0 && u <= 1)) {
    return new Point(p1.x + t * dx1, p1.y + t * dy1);
  }

  return null;
}

function graham() {
  points = performGrahamScan(points);
}

function performGrahamScan(inPoints) {
  const minPoint = findLowestY(inPoints);
  let sortedPoints = sortPointsFrom(
    inPoints.slice(1, inPoints.length[-1]),
    minPoint
  );

  sortedPoints.unshift(minPoint);
  let stack = [];

  sortedPoints.forEach((point) => {
    while (
      stack.length > 1 &&
      calculateDeterminant([stack.at(-2), stack.at(-1), point]) >= 0
    ) {
      stack.pop();
    }
    stack.push(point);
  });

  return stack;
}

function sortPointsFrom(inPoints, someMinPoint) {
  function leftChildOf(i) {
    return 2 * i + 1;
  }

  let start = floor(inPoints.length / 2);
  let end = inPoints.length;
  while (end > 1) {
    if (start > 0) start--;
    else {
      end--;
      const last = inPoints[end];
      const first = inPoints[0];

      inPoints[end] = first;
      inPoints[0] = last;
    }
    let rootPos = start;
    while (leftChildOf(rootPos) < end) {
      let childPos = leftChildOf(rootPos);
      if (
        childPos + 1 < end &&
        inPoints[childPos].lt(someMinPoint, inPoints[childPos + 1])
      ) {
        childPos = childPos + 1;
      }
      let root = inPoints[rootPos];
      const child = inPoints[childPos];
      if (root.lt(someMinPoint, child)) {
        inPoints[rootPos] = child;
        inPoints[childPos] = root;
        rootPos = childPos;
      } else break;
    }
  }
  return inPoints;
}

function findLowestY() {
  let minPoint = new Point(0, windowWidth + 1);
  points.forEach((element) => {
    if (element.y <= minPoint.y) {
      if (element.y !== minPoint.y) minPoint = element;
      else if (element.x < minPoint.x) minPoint = element;
    }
  });
  return minPoint;
}

function calculateDeterminant(points) {
  const [a, b, c] = points;

  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

// generated by Deepseek R1
function drawColoredSequence(letterArray, x, y) {
  push();
  let currentX = x;

  const upTo = letterArray.length - 1;
  for (let i = 0; i < upTo; i++) {
    fill(letterArray[i][1]);
    text(letterArray[i][0], currentX, y);
    currentX += textWidth(letterArray[i][0]);

    fill(0);
    text("|", currentX, y);
    currentX += textWidth("|");
  }

  fill(letterArray[upTo][1]);
  text(letterArray[upTo][0], currentX, y);

  pop();
}

function draw() {
  background(150);
  let j = 0;
  for (const pointSubSet of points) {
    fill(colours[j % 4]);

    beginShape();
    pointSubSet.forEach((point) => {
      vertex(point.x, point.y);
    });
    endShape(CLOSE);
    j++;
  }

  let elapsed = millis() - startTime;

  // inspired from Deepseek R1
  if (elapsed < displayDuration) {
    drawColoredSequence(letterColorPairs, 30, 50);
  } else {
    fill(0);
    text("Try it", 30, 50);
  }
}

function mousePressed() {
  const elapsed = millis() - startTime;
  if (mouseY > 100 && elapsed > displayDuration + 100) {
    const point = new Point(mouseX, mouseY);
    const correct =
      approximationTrees[sequenceOfPos[currentSequencePos]].contains(point);
    if (correct) {
      currentSequencePos += 1;
      console.log("here");
      if (currentSequencePos === letterColorPairs.length) {
        currentSequencePos = 0;
        const choice = Math.floor(random(4));
        console.log(choice);
        letterColorPairs.push(colourLetters[choice]);
        sequenceOfPos.push(choice);
        startTime = millis();
        displayDuration += 100;
      }
    } else {
      currentSequencePos = 0;
      const choice = Math.floor(random(4));
      letterColorPairs = [colourLetters[choice]];

      sequenceOfPos = [choice];
      startTime = millis();
      displayDuration = 1500;
    }
  }
}

windowResized = function () {
  resizeCanvas(windowWidth - 4, windowHeight - 4);
};
