"""A from-scratch mass-action reaction-kinetics simulator, in the spirit of
Virtual Cell's ODE/compartmental mode: a student defines species and
reactions, and gets back concentration-over-time curves.

This is NOT an integration with VCell's actual hosted platform -- that
would require API credentials against VCell's own server, which we don't
have. This is our own equivalent, built with scipy, covering the same
pedagogical use case (simple reaction-network kinetics) end to end without
any external dependency.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request, status
from scipy.integrate import solve_ivp

from app.core.security import enforce_rate_limit
from app.routers.auth import get_current_user
from app.schemas import BioSimulationRequest, BioSimulationResponse

router = APIRouter(prefix="/api/bio-lab", tags=["bio-lab"])


def _build_rate_equations(payload: BioSimulationRequest):
    species_index: Dict[str, int] = {s.name: i for i, s in enumerate(payload.species)}

    for reaction in payload.reactions:
        for participant in reaction.reactants + reaction.products:
            if participant.species not in species_index:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reaction references undefined species '{participant.species}'.",
                )

    def derivatives(_t, concentrations):
        rates = np.zeros(len(species_index))
        for reaction in payload.reactions:
            # Mass-action rate = k * product(reactant concentrations ^ stoichiometry)
            rate = reaction.rate_constant
            for reactant in reaction.reactants:
                idx = species_index[reactant.species]
                rate *= max(concentrations[idx], 0.0) ** reactant.stoichiometry
            for reactant in reaction.reactants:
                idx = species_index[reactant.species]
                rates[idx] -= rate * reactant.stoichiometry
            for product in reaction.products:
                idx = species_index[product.species]
                rates[idx] += rate * product.stoichiometry
        return rates

    return species_index, derivatives


@router.post("/simulate", response_model=BioSimulationResponse)
async def simulate_reaction_network(
    payload: BioSimulationRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Solve the ODE system for a mass-action reaction network and return
    concentration-vs-time series for every species, ready to chart."""
    enforce_rate_limit(request, "bio-lab-simulate", limit=60, window_seconds=300)

    names = [s.name for s in payload.species]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Species names must be unique.")

    species_index, derivatives = _build_rate_equations(payload)
    initial = np.array([s.initial_concentration for s in payload.species], dtype=float)
    t_eval = np.linspace(0, payload.duration, payload.points)

    try:
        solution = solve_ivp(
            derivatives,
            t_span=(0, payload.duration),
            y0=initial,
            t_eval=t_eval,
            method="LSODA",
            rtol=1e-6,
            atol=1e-9,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Couldn't solve that reaction system: {exc}") from exc

    if not solution.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Solver didn't converge: {solution.message}")

    concentrations: Dict[str, List[float]] = {
        name: [round(float(v), 8) for v in solution.y[idx]]
        for name, idx in species_index.items()
    }

    return BioSimulationResponse(
        species_names=names,
        time_points=[round(float(t), 6) for t in solution.t],
        concentrations=concentrations,
    )
