import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createEvent } from "@/lib/mockApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateEventPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesLocal, setClosesLocal] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [busy, setBusy] = useState(false);

  function setOutcome(i: number, v: string) {
    setOutcomes((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });
  }

  function addOutcome() {
    setOutcomes((prev) => [...prev, ""]);
  }

  function removeOutcome(i: number) {
    setOutcomes((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, j) => j !== i);
    });
  }

  async function submit() {
    const labels = outcomes.map((s) => s.trim()).filter(Boolean);
    if (labels.length < 2) {
      toast.error("Нужно минимум два непустых исхода");
      return;
    }
    if (!title.trim()) {
      toast.error("Название обязательно");
      return;
    }
    if (!closesLocal) {
      toast.error("Укажите дату и время окончания приёма");
      return;
    }
    const closesAt = new Date(closesLocal);
    if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
      toast.error("Время окончания должно быть в будущем");
      return;
    }
    setBusy(true);
    const id = await createEvent({
      title: title.trim(),
      description: description.trim() || null,
      closesAtIso: closesAt.toISOString(),
      outcomeLabels: labels,
    });
    setBusy(false);
    toast.success("Событие создано");
    nav(`/events/${id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новое событие</h1>
        <p className="text-sm text-muted-foreground">
          Укажите исходы (от 2) и время окончания приёма ставок (ваше локальное
          время → сохранится в UTC, а отображаться будет по Москве).
        </p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Параметры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название события"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Описание</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="По желанию"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closes">Окончание приёма ставок</Label>
            <Input
              id="closes"
              type="datetime-local"
              value={closesLocal}
              onChange={(e) => setClosesLocal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Исходы</Label>
            <ul className="space-y-2">
              {outcomes.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <Input
                    value={o}
                    onChange={(e) => setOutcome(i, e.target.value)}
                    placeholder={`Исход ${i + 1}`}
                  />
                  {outcomes.length > 2 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeOutcome(i)}
                      aria-label="Удалить исход"
                    >
                      ×
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" size="sm" onClick={addOutcome}>
              Добавить исход
            </Button>
          </div>
          <Button
            className="w-full min-h-11"
            type="button"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Создание…" : "Создать событие"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
