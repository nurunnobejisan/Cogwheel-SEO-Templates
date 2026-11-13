import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addTrainingRule,
  deleteTrainingRule,
  listTrainingRules,
  toggleTrainingRule,
} from "@/core/training";

export const dynamic = "force-dynamic";

const createRuleSchema = z.object({
  taskId: z.string().nullable().optional(),
  title: z.string().min(2, "Title is required"),
  ruleText: z.string().min(5, "Rule or feedback text is required"),
  exampleBad: z.string().optional(),
  exampleGood: z.string().optional(),
});

const toggleRuleSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId") || undefined;
  const rules = await listTrainingRules(taskId);
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createRuleSchema.parse(body);
    const rule = await addTrainingRule(parsed);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid training rule";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = toggleRuleSchema.parse(body);
    const rule = await toggleTrainingRule(parsed.id, parsed.active);
    if (!rule) {
      return NextResponse.json({ error: "Training rule not found" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const deleted = await deleteTrainingRule(id);
  return NextResponse.json({ deleted });
}
