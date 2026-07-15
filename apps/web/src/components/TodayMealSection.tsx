"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, type MealProposal, type Recipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function TodayMealSection() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "cook";
  const [proposal, setProposal] = useState<MealProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const { proposal } = await api.getMealProposal();
      setProposal(proposal);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    void api.listRecipes(query || undefined).then(({ recipes }) => setSearchResults(recipes.slice(0, 20)));
  }, [showPicker, query]);

  function toggleDraft(id: string) {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onCreateProposal() {
    if (draftIds.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const { proposal } = await api.createMealProposal({ recipeIds: draftIds });
      setProposal(proposal);
      setShowPicker(false);
      setDraftIds([]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onAddCandidate(recipeId: string) {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const { proposal: updated } = await api.addMealProposalCandidate(proposal.id, recipeId);
      setProposal(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "追加に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveCandidate(candidateId: string) {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const { proposal: updated } = await api.removeMealProposalCandidate(proposal.id, candidateId);
      setProposal(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onVote(candidateId: string) {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const isSame = proposal.myVoteCandidateId === candidateId;
      const { proposal: updated } = isSame
        ? await api.retractMealProposalVote(proposal.id)
        : await api.voteMealProposal(proposal.id, candidateId);
      setProposal(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "投票に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(candidateId: string) {
    if (!proposal) return;
    if (!confirm("この献立に決定しますか？")) return;
    setBusy(true);
    setError("");
    try {
      const { proposal: updated } = await api.decideMealProposal(proposal.id, candidateId);
      setProposal(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "決定に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onAddToShoppingList(recipeId: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { added } = await api.addShoppingListFromRecipe(recipeId, user?.householdSize);
      setMessage(`買い物リストに${added}品目を追加しました`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "買い物リストへの追加に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const decidedCandidate = proposal?.candidates.find((c) => c.recipeId === proposal.decidedRecipeId);

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0 }}>今日のご飯何がいい?</h2>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="hint">{message}</p> : null}

      {proposal?.status === "decided" ? (
        <div style={{ marginTop: 12 }}>
          <p className="hint">今日はこれを作ることにしました</p>
          <div className="row" style={{ gap: 14, marginTop: 6, alignItems: "center" }}>
            {decidedCandidate?.recipeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={api.imageSrc(decidedCandidate.recipeImageUrl) ?? undefined}
                alt=""
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12 }}
              />
            ) : null}
            <Link href={`/recipes/${proposal.decidedRecipeId}`}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
                {decidedCandidate?.recipeName}
              </strong>
            </Link>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Link href={`/cook/new?recipeId=${proposal.decidedRecipeId}`} className="btn">
              作った
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void onAddToShoppingList(proposal.decidedRecipeId!)}
            >
              買い物リストに追加
            </button>
          </div>
        </div>
      ) : proposal ? (
        <div style={{ marginTop: 12 }}>
          <p className="hint">気になるものに投票してください（{proposal.forDate}）</p>
          <ul className="clean stack" style={{ marginTop: 10 }}>
            {proposal.candidates.map((cand) => {
              const isMine = proposal.myVoteCandidateId === cand.id;
              return (
                <li
                  key={cand.id}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div>
                    <Link href={`/recipes/${cand.recipeId}`}>
                      <strong>{cand.recipeName}</strong>
                    </Link>
                    <div className="hint">
                      {cand.votes.length}票
                      {cand.votes.length > 0 ? ` · ${cand.votes.map((v) => v.displayName).join("・")}` : ""}
                    </div>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className={isMine ? "btn" : "btn btn-secondary"}
                      disabled={busy}
                      onClick={() => void onVote(cand.id)}
                    >
                      {isMine ? "投票済み" : "投票する"}
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => void onDecide(cand.id)}
                        >
                          これに決定
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => void onRemoveCandidate(cand.id)}
                          aria-label="候補から外す"
                        >
                          ×
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {canManage ? (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPicker((v) => !v)}
              >
                + 候補を追加
              </button>
              {showPicker ? (
                <div style={{ marginTop: 10 }}>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="レシピを検索"
                    style={{
                      width: "100%",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      marginBottom: 8,
                    }}
                  />
                  <ul className="clean stack" style={{ maxHeight: 220, overflowY: "auto" }}>
                    {searchResults
                      .filter((r) => !proposal.candidates.some((c) => c.recipeId === r.id))
                      .map((r) => (
                        <li key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                          <span>{r.name}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => void onAddCandidate(r.id)}
                          >
                            追加
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : canManage ? (
        <div style={{ marginTop: 12 }}>
          <p className="hint">今日の候補を選んで、家族に投票してもらいましょう</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowPicker((v) => !v)}
          >
            候補を選ぶ
          </button>
          {showPicker ? (
            <div style={{ marginTop: 10 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="レシピを検索"
                style={{
                  width: "100%",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 8,
                }}
              />
              <ul className="clean stack" style={{ maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
                {searchResults.map((r) => (
                  <li key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                    <label className="row" style={{ gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={draftIds.includes(r.id)}
                        onChange={() => toggleDraft(r.id)}
                      />
                      {r.name}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn"
                disabled={draftIds.length === 0 || busy}
                onClick={() => void onCreateProposal()}
              >
                {busy ? "作成中…" : `この${draftIds.length}品で候補を出す`}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 12 }}>
          調理者が今日の候補を出すのを待ちましょう
        </p>
      )}
    </section>
  );
}
