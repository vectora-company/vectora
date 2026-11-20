"""Histórico com partes: raciocínio e tool calls reconstruídos do que foi persistido."""

from __future__ import annotations

from backend.services.agent_factory import (
    _history_pairs_from_messages,
    _history_parts,
)
from backend.vtypes.history import RESULT_PREVIEW_CHARS, HistoryToolCallPart
from backend.vtypes.message import ContentBlock, MessageRole, ToolCall, VMessage


def _snapshot() -> list[tuple[int, VMessage]]:
    user = VMessage(
        role=MessageRole.USER, content=[ContentBlock(kind="text", text="liste")]
    )
    tool_only = VMessage(
        role=MessageRole.ASSISTANT,
        content=[ContentBlock(kind="reasoning", reasoning_text="preciso listar")],
        tool_calls=[ToolCall(id="c1", name="list_directory", args={"path": "."})],
        finish_reason="tool_calls",
    )
    result = VMessage(
        role=MessageRole.TOOL,
        content=[ContentBlock(kind="text", text='{"files": ["a.py"]}')],
        tool_call_id="c1",
        name="list_directory",
    )
    answer = VMessage(
        role=MessageRole.ASSISTANT,
        content=[ContentBlock(kind="text", text="Só há a.py")],
        finish_reason="stop",
    )
    return [(1, user), (2, tool_only), (3, result), (4, answer)]


def test_tool_only_assistant_message_stays_in_history() -> None:
    snapshot = _snapshot()

    without = _history_pairs_from_messages("t", snapshot)
    with_tools = _history_pairs_from_messages("t", snapshot, keep_tool_only=True)

    assert [p[2] for p in without] == ["1", "4"]
    assert [p[2] for p in with_tools] == ["1", "2", "4"]


def test_parts_carry_reasoning_and_tool_call_with_result() -> None:
    parts = _history_parts(_snapshot())

    assert set(parts) == {"2"}
    reasoning, call = parts["2"]
    assert reasoning.kind == "reasoning"
    assert reasoning.text == "preciso listar"
    assert isinstance(call, HistoryToolCallPart)
    assert call.tool_call_id == "c1"
    assert call.tool_name == "list_directory"
    assert call.args_json == '{"path": "."}'
    assert call.result_json == '{"files": ["a.py"]}'
    assert call.is_error is False


def test_tool_call_without_result_has_no_result_yet() -> None:
    snapshot = _snapshot()[:2]

    (_reasoning, call) = _history_parts(snapshot)["2"]

    assert isinstance(call, HistoryToolCallPart)
    assert call.result_json is None
    assert call.is_error is None


def test_large_results_are_truncated_in_history() -> None:
    snapshot = _snapshot()
    snapshot[2] = (
        3,
        VMessage(
            role=MessageRole.TOOL,
            content=[ContentBlock(kind="text", text="x" * 20_000)],
            tool_call_id="c1",
        ),
    )

    (_reasoning, call) = _history_parts(snapshot)["2"]

    assert isinstance(call, HistoryToolCallPart)
    assert call.result_json is not None
    assert len(call.result_json) == RESULT_PREVIEW_CHARS


def test_tool_metadata_comes_from_the_registry() -> None:
    import backend.nodes.tools

    (_reasoning, call) = _history_parts(_snapshot())["2"]

    assert isinstance(call, HistoryToolCallPart)
    assert call.render_hint
    assert call.category
