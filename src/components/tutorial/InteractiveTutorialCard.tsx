import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export type TutorialStepConfig = {
  id: string;
  title: string;
  description: string;
  required?: boolean;
  complete?: boolean;
  skipped?: boolean;
};

interface InteractiveTutorialCardProps {
  storageKey: string;
  title: string;
  description: string;
  steps: TutorialStepConfig[];
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  className?: string;
  footer?: React.ReactNode;
}

export const tutorialSectionClass = (active?: boolean) =>
  active
    ? "rounded-2xl border border-amber-300 bg-amber-50/60 shadow-[0_0_0_3px_rgba(251,191,36,0.14)] transition-colors"
    : "";

const InteractiveTutorialCard: React.FC<InteractiveTutorialCardProps> = ({
  storageKey,
  title,
  description,
  steps,
  activeStepId,
  onSelectStep,
  enabled,
  onEnabledChange,
  className,
  footer,
}) => {
  const [internalEnabled, setInternalEnabled] = useTutorialMode(storageKey, true);
  const tutorialEnabled = enabled ?? internalEnabled;
  const setTutorialEnabled = onEnabledChange ?? setInternalEnabled;
  const visibleSteps = steps.filter(Boolean);
  const selectedIndex = Math.max(
    0,
    visibleSteps.findIndex((step) => step.id === activeStepId)
  );
  const currentStep = visibleSteps[selectedIndex] || visibleSteps[0] || null;

  const moveSelection = (direction: -1 | 1) => {
    if (!visibleSteps.length || !onSelectStep) return;
    const nextIndex = Math.min(
      visibleSteps.length - 1,
      Math.max(0, selectedIndex + direction)
    );
    const nextStep = visibleSteps[nextIndex];
    if (nextStep) onSelectStep(nextStep.id);
  };

  return (
    <Card className={cn("rounded-3xl border-slate-200 shadow-sm", className)}>
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                Tutorial
              </Badge>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Interactive
              </span>
            </div>
            <CardTitle className="mt-3 text-lg text-slate-950">{title}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-700">
              {tutorialEnabled ? "On" : "Off"}
            </span>
            <Switch
              checked={tutorialEnabled}
              onCheckedChange={setTutorialEnabled}
              aria-label={`Toggle ${title} tutorial`}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {!tutorialEnabled ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Turn tutorial mode on to get stepwise guidance for this page.
          </div>
        ) : currentStep ? (
          <>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-700" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                      Active Step
                    </span>
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-950">
                    {selectedIndex + 1}. {currentStep.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {currentStep.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "bg-white",
                    currentStep.complete && "border-teal-300 text-teal-800",
                    currentStep.skipped && "border-slate-300 text-slate-700",
                    !currentStep.complete &&
                      !currentStep.skipped &&
                      currentStep.required &&
                      "border-amber-300 text-amber-900"
                  )}
                >
                  {currentStep.complete
                    ? "Done"
                    : currentStep.skipped
                    ? "Skipped"
                    : currentStep.required
                    ? "Mandatory"
                    : "Optional"}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveSelection(-1)}
                  disabled={selectedIndex <= 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveSelection(1)}
                  disabled={selectedIndex >= visibleSteps.length - 1}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Badge variant="outline" className="bg-white">
                  Step {selectedIndex + 1} of {visibleSteps.length}
                </Badge>
              </div>
            </div>

            <div className="grid gap-2">
              {visibleSteps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectStep?.(step.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    step.id === currentStep.id
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-950">
                      {index + 1}. {step.title}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "bg-white",
                        step.complete && "border-teal-300 text-teal-800",
                        step.skipped && "border-slate-300 text-slate-700"
                      )}
                    >
                      {step.complete
                        ? "Done"
                        : step.skipped
                        ? "Skipped"
                        : step.required
                        ? "Required"
                        : "Optional"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            {footer}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No tutorial steps are defined for this page yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InteractiveTutorialCard;
