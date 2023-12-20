const DEFAULT_TOL = 1e-5;

export function gt(a: number, b: number, tol = DEFAULT_TOL): boolean {
  return tolCompare(a, b, tol) === 1;
}

export function gte(a: number, b: number, tol = DEFAULT_TOL): boolean {
  return tolCompare(a, b, tol) >= 0;
}

export function lt(a: number, b: number, tol = DEFAULT_TOL): boolean {
  return tolCompare(a, b, tol) === -1;
}

export function lte(a: number, b: number, tol = DEFAULT_TOL): boolean {
  return tolCompare(a, b, tol) <= 0;
}

export function closeTo(a: number, b: number, tol = DEFAULT_TOL): boolean {
  return tolCompare(a, b, tol) === 0;
}

/**
 * Compare a to b within tolerance
 *
 * Returns:
 *   1  a > b
 *   0  a ~= b
 *   -1 a < b
 */
export function tolCompare(a: number, b: number, tol = 1e-5): number {
  const almostEqual = Math.abs(a - b) < tol;
  if (almostEqual) {
    return 0;
  } else if (a > b) {
    return 1;
  } else {
    return -1;
  }
}
