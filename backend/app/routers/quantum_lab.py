"""Small quantum circuit simulator for teaching qubits/superposition/
entanglement, backed by both Qiskit and Cirq.

Circuits are deliberately capped at 4 qubits and 50 gates -- this is a
classroom visualization tool (feeds a 3D Bloch sphere per qubit), not a
research simulator. Every circuit is run through *both* Qiskit and Cirq
independently and the two probability distributions are compared; if they
ever disagree beyond floating-point tolerance, that's surfaced to the
caller rather than silently trusting one engine.
"""
from __future__ import annotations

from typing import List

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request, status
from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace
import cirq

from app.core.security import enforce_rate_limit
from app.routers.auth import get_current_user
from app.schemas import (
    QuantumBlochVector,
    QuantumCircuitRequest,
    QuantumCircuitResponse,
    QuantumGateOp,
)

router = APIRouter(prefix="/api/quantum-lab", tags=["quantum-lab"])

SINGLE_QUBIT_GATES = {"h", "x", "y", "z", "s", "t", "sdg", "tdg"}
ROTATION_GATES = {"rx", "ry", "rz"}
TWO_QUBIT_GATES = {"cx", "cz", "swap"}
VALID_GATES = SINGLE_QUBIT_GATES | ROTATION_GATES | TWO_QUBIT_GATES

_PAULI_X = np.array([[0, 1], [1, 0]], dtype=complex)
_PAULI_Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
_PAULI_Z = np.array([[1, 0], [0, -1]], dtype=complex)


def _validate_gate(op: QuantumGateOp, num_qubits: int) -> None:
    gate = op.gate.strip().lower()
    if gate not in VALID_GATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown gate '{op.gate}'. Valid gates: {', '.join(sorted(VALID_GATES))}",
        )
    for q in op.qubits:
        if q < 0 or q >= num_qubits:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Qubit index {q} is out of range for a {num_qubits}-qubit circuit.")
    if gate in TWO_QUBIT_GATES and len(op.qubits) != 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Gate '{gate}' needs exactly 2 qubits.")
    if gate in (SINGLE_QUBIT_GATES | ROTATION_GATES) and len(op.qubits) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Gate '{gate}' needs exactly 1 qubit.")
    if gate in ROTATION_GATES and op.angle is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Gate '{gate}' needs an angle (in radians).")


def _build_qiskit_circuit(payload: QuantumCircuitRequest) -> QuantumCircuit:
    circuit = QuantumCircuit(payload.num_qubits)
    for op in payload.gates:
        gate = op.gate.strip().lower()
        q = op.qubits
        if gate == "h":
            circuit.h(q[0])
        elif gate == "x":
            circuit.x(q[0])
        elif gate == "y":
            circuit.y(q[0])
        elif gate == "z":
            circuit.z(q[0])
        elif gate == "s":
            circuit.s(q[0])
        elif gate == "t":
            circuit.t(q[0])
        elif gate == "sdg":
            circuit.sdg(q[0])
        elif gate == "tdg":
            circuit.tdg(q[0])
        elif gate == "rx":
            circuit.rx(op.angle, q[0])
        elif gate == "ry":
            circuit.ry(op.angle, q[0])
        elif gate == "rz":
            circuit.rz(op.angle, q[0])
        elif gate == "cx":
            circuit.cx(q[0], q[1])
        elif gate == "cz":
            circuit.cz(q[0], q[1])
        elif gate == "swap":
            circuit.swap(q[0], q[1])
    return circuit


def _build_cirq_circuit(payload: QuantumCircuitRequest):
    qubits = cirq.LineQubit.range(payload.num_qubits)
    circuit = cirq.Circuit()
    for op in payload.gates:
        gate = op.gate.strip().lower()
        q = [qubits[i] for i in op.qubits]
        if gate == "h":
            circuit.append(cirq.H(q[0]))
        elif gate == "x":
            circuit.append(cirq.X(q[0]))
        elif gate == "y":
            circuit.append(cirq.Y(q[0]))
        elif gate == "z":
            circuit.append(cirq.Z(q[0]))
        elif gate == "s":
            circuit.append(cirq.S(q[0]))
        elif gate == "t":
            circuit.append(cirq.T(q[0]))
        elif gate == "sdg":
            circuit.append((cirq.S**-1)(q[0]))
        elif gate == "tdg":
            circuit.append((cirq.T**-1)(q[0]))
        elif gate == "rx":
            circuit.append(cirq.rx(op.angle)(q[0]))
        elif gate == "ry":
            circuit.append(cirq.ry(op.angle)(q[0]))
        elif gate == "rz":
            circuit.append(cirq.rz(op.angle)(q[0]))
        elif gate == "cx":
            circuit.append(cirq.CNOT(q[0], q[1]))
        elif gate == "cz":
            circuit.append(cirq.CZ(q[0], q[1]))
        elif gate == "swap":
            circuit.append(cirq.SWAP(q[0], q[1]))
    return circuit, qubits


def _basis_labels(num_qubits: int) -> List[str]:
    return [format(i, f"0{num_qubits}b") for i in range(2 ** num_qubits)]


def _bloch_vectors(statevector: Statevector, num_qubits: int) -> List[QuantumBlochVector]:
    density = DensityMatrix(statevector)
    vectors = []
    for qubit in range(num_qubits):
        others = [i for i in range(num_qubits) if i != qubit]
        reduced = partial_trace(density, others) if others else density
        rho = reduced.data
        x = float(np.real(np.trace(rho @ _PAULI_X)))
        y = float(np.real(np.trace(rho @ _PAULI_Y)))
        z = float(np.real(np.trace(rho @ _PAULI_Z)))
        purity = float(np.sqrt(x ** 2 + y ** 2 + z ** 2))
        vectors.append(QuantumBlochVector(qubit=qubit, x=round(x, 6), y=round(y, 6), z=round(z, 6), purity=round(purity, 6)))
    return vectors


@router.post("/simulate", response_model=QuantumCircuitResponse)
async def simulate_circuit(
    payload: QuantumCircuitRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Simulate a small circuit with both Qiskit and Cirq, cross-checking
    that they agree, and return measurement probabilities plus a Bloch
    vector per qubit for 3D visualization."""
    enforce_rate_limit(request, "quantum-lab-simulate", limit=60, window_seconds=300)

    for op in payload.gates:
        _validate_gate(op, payload.num_qubits)

    # Qiskit: statevector simulation (no measurement/shots needed for exact probabilities).
    qiskit_circuit = _build_qiskit_circuit(payload)
    try:
        qiskit_state = Statevector.from_instruction(qiskit_circuit)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Qiskit couldn't simulate that circuit: {exc}") from exc
    qiskit_probs = [round(float(p), 8) for p in qiskit_state.probabilities()]

    # Cirq: independent simulation of the same circuit, for cross-validation.
    cirq_circuit, cirq_qubits = _build_cirq_circuit(payload)
    try:
        cirq_result = cirq.Simulator().simulate(cirq_circuit, qubit_order=cirq_qubits)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cirq couldn't simulate that circuit: {exc}") from exc
    cirq_probs = [round(float(abs(amp) ** 2), 8) for amp in cirq_result.final_state_vector]

    engines_agree = all(abs(a - b) < 1e-4 for a, b in zip(qiskit_probs, cirq_probs))

    return QuantumCircuitResponse(
        num_qubits=payload.num_qubits,
        basis_states=_basis_labels(payload.num_qubits),
        probabilities=qiskit_probs,
        bloch_vectors=_bloch_vectors(qiskit_state, payload.num_qubits),
        qiskit_probabilities=qiskit_probs,
        cirq_probabilities=cirq_probs,
        engines_agree=engines_agree,
    )
