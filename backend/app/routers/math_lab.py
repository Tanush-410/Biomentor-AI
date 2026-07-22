"""Symbolic math tools backed by SymPy: solve, simplify, differentiate,
integrate, evaluate, and sample functions for plotting.

This is intentionally a pure computation layer with no storage -- the
frontend's Math Lab page calls these endpoints on demand (e.g. alongside a
GeoGebra graph) rather than anything being persisted server-side.
"""
from __future__ import annotations

import math
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
import sympy
from sympy import symbols, solve, simplify, diff, integrate, latex, N
from sympy.core.sympify import SympifyError
from sympy.parsing.sympy_parser import parse_expr

from app.core.security import enforce_rate_limit
from app.routers.auth import get_current_user
from app.schemas import MathLabPlotRequest, MathLabPlotResponse, MathLabRequest, MathLabResponse

router = APIRouter(prefix="/api/math-lab", tags=["math-lab"])

VALID_OPERATIONS = {"solve", "simplify", "derivative", "integral", "evaluate"}

# Only expose a safe, well-known subset of SymPy/math functions to the parser
# so a user-supplied expression can't reach into arbitrary Python internals.
_SAFE_NAMES = {
    name: getattr(sympy, name)
    for name in (
        "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
        "exp", "log", "sqrt", "pi", "E", "Abs", "factorial", "oo",
    )
}

# Only letters, digits, whitespace, and basic math punctuation are allowed.
# This blocks dunder access, string literals, and any attempt to reach
# outside the whitelisted symbol table (e.g. "__import__('os')" or "open(...)").
_SAFE_EXPRESSION_PATTERN = re.compile(r"^[A-Za-z0-9\s\.\,\+\-\*\/\^\(\)\!\=]*$")


def _parse_expression(expression: str, variable: str):
    if not _SAFE_EXPRESSION_PATTERN.match(expression):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expression contains characters that aren't allowed. Use numbers, letters, and + - * / ^ ( ) only.",
        )
    if "__" in expression:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expression contains disallowed characters.")

    try:
        var = symbols(variable)
        local_dict = {**_SAFE_NAMES, variable: var}
        # parse_expr's own tokenizer transformations (auto_number, auto_symbol,
        # etc.) need these core SymPy constructors in scope to build the
        # expression tree. __builtins__ is explicitly emptied so eval() inside
        # SymPy's parser has no access to real Python builtins (import, open,
        # exec, etc.) -- only these constructors, the whitelisted math names,
        # and the target variable are resolvable.
        global_dict = {
            "__builtins__": {},
            "Integer": sympy.Integer,
            "Float": sympy.Float,
            "Rational": sympy.Rational,
            "Symbol": sympy.Symbol,
            "Function": sympy.Function,
        }
        parsed = parse_expr(expression, local_dict=local_dict, global_dict=global_dict, evaluate=True)
        return parsed, var
    except HTTPException:
        raise
    except (SympifyError, TypeError, ValueError, SyntaxError, NameError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Couldn't parse that expression: {exc}",
        ) from exc


def _numeric_approx(value) -> Optional[str]:
    try:
        approx = N(value)
        if approx.is_real is False:
            return str(approx)
        return str(approx)
    except Exception:
        return None


@router.post("/compute", response_model=MathLabResponse)
async def compute(
    payload: MathLabRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Run a symbolic operation (solve/simplify/derivative/integral/evaluate)
    on a user-supplied expression."""
    enforce_rate_limit(request, "math-lab-compute", limit=60, window_seconds=300)

    operation = payload.operation.strip().lower()
    if operation not in VALID_OPERATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"operation must be one of: {', '.join(sorted(VALID_OPERATIONS))}",
        )

    expr, var = _parse_expression(payload.expression, payload.variable)

    try:
        if operation == "solve":
            solutions = solve(expr, var)
            result_value = solutions
            result_str = ", ".join(str(s) for s in solutions) if solutions else "No solution found"
            result_latex = ", ".join(latex(s) for s in solutions) if solutions else None
            numeric = ", ".join(_numeric_approx(s) or str(s) for s in solutions) if solutions else None
        elif operation == "simplify":
            result_value = simplify(expr)
            result_str = str(result_value)
            result_latex = latex(result_value)
            numeric = _numeric_approx(result_value)
        elif operation == "derivative":
            result_value = diff(expr, var)
            result_str = str(result_value)
            result_latex = latex(result_value)
            numeric = None
        elif operation == "integral":
            result_value = integrate(expr, var)
            result_str = f"{result_value} + C"
            result_latex = f"{latex(result_value)} + C"
            numeric = None
        else:  # evaluate
            result_value = simplify(expr)
            result_str = str(result_value)
            result_latex = latex(result_value)
            numeric = _numeric_approx(result_value)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Couldn't compute that: {exc}",
        ) from exc

    return MathLabResponse(
        operation=operation,
        input_expression=payload.expression,
        variable=payload.variable,
        result=result_str,
        result_latex=result_latex,
        numeric_approx=numeric,
    )


@router.post("/plot", response_model=MathLabPlotResponse)
async def plot(
    payload: MathLabPlotRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Sample a function of one variable over a range, for feeding into a
    chart alongside (or instead of) GeoGebra's own graphing view."""
    enforce_rate_limit(request, "math-lab-plot", limit=60, window_seconds=300)

    if payload.x_max <= payload.x_min:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="x_max must be greater than x_min")

    expr, var = _parse_expression(payload.expression, payload.variable)

    try:
        func = sympy.lambdify(var, expr, modules=["math"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Couldn't prepare that function: {exc}") from exc

    step = (payload.x_max - payload.x_min) / (payload.points - 1)
    x_values: List[float] = []
    y_values: List[Optional[float]] = []
    for i in range(payload.points):
        x_val = payload.x_min + step * i
        x_values.append(x_val)
        try:
            y_val = func(x_val)
            if isinstance(y_val, complex) or not math.isfinite(y_val):
                y_values.append(None)
            else:
                y_values.append(float(y_val))
        except Exception:
            y_values.append(None)

    return MathLabPlotResponse(
        expression=payload.expression,
        variable=payload.variable,
        x_values=x_values,
        y_values=y_values,
    )
