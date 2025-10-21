import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface Phase {
  number: number;
  title: string;
  goal: string;
  outcomes: string[];
  status: "complete" | "current" | "upcoming";
  eta: string;
  tasks: Array<{ text: string; done: boolean }>;
}

const phases: Phase[] = [
  {
    number: 1,
    title: "Autonomous Evidence Foundation",
    goal: "Build truth before scoring",
    status: "current",
    eta: "Immediate",
    outcomes: [
      "Every brand has growing timeline of verified events",
      "Continuous evidence flow without manual triggers"
    ],
    tasks: [
      { text: "Make news ingestion fully automatic", done: false },
      { text: "Add 'Monitoring in progress' UI", done: true },
      { text: "Store structured events reliably", done: true }
    ]
  },
  {
    number: 2,
    title: "Evidence Intelligence Layer",
    goal: "Make data meaningful",
    status: "upcoming",
    eta: "1-2 weeks",
    outcomes: [
      "Users see why a brand has its score",
      "Audit trail + transparency"
    ],
    tasks: [
      { text: "Auto-categorize events (environment, labor, political)", done: false },
      { text: "Implement confidence scoring in background", done: false },
      { text: "Reveal real scores when thresholds met", done: false },
      { text: "Add data timeline / evidence density view", done: false }
    ]
  },
  {
    number: 3,
    title: "User Interaction Tools",
    goal: "Connect reality to people",
    status: "upcoming",
    eta: "After Phase 2",
    outcomes: [
      "Public accountability web",
      "Trace every purchase to corporate source"
    ],
    tasks: [
      { text: "Barcode scanner integration (UPC → brand)", done: false },
      { text: "Ownership web / corporate graph visualization", done: false },
      { text: "Parent company rollups", done: false },
      { text: "Proof of purchase linking", done: false }
    ]
  },
  {
    number: 4,
    title: "Social & Verification Layer",
    goal: "Self-growing truth ecosystem",
    status: "upcoming",
    eta: "Later",
    outcomes: [
      "Crowdsourced evidence",
      "Public trust infrastructure"
    ],
    tasks: [
      { text: "User flagging for missing brands", done: false },
      { text: "Contributor evidence attachment", done: false },
      { text: "Moderation pipeline", done: false },
      { text: "Verified by metadata", done: false }
    ]
  }
];

const getStatusConfig = (status: Phase["status"]) => {
  switch (status) {
    case "complete":
      return {
        icon: CheckCircle2,
        color: "text-success",
        bg: "bg-success/10",
        badge: "Complete"
      };
    case "current":
      return {
        icon: Clock,
        color: "text-primary",
        bg: "bg-primary/10",
        badge: "In Progress"
      };
    case "upcoming":
      return {
        icon: Circle,
        color: "text-muted-foreground",
        bg: "bg-muted",
        badge: "Upcoming"
      };
  }
};

export function RoadmapDiagram() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Development Roadmap</h2>
        <p className="text-muted-foreground">
          Building Barcode Truth: From evidence collection to public accountability
        </p>
      </div>

      <div className="relative space-y-8">
        {/* Vertical connector line */}
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

        {phases.map((phase) => {
          const config = getStatusConfig(phase.status);
          const Icon = config.icon;
          const completedTasks = phase.tasks.filter(t => t.done).length;
          const totalTasks = phase.tasks.length;

          return (
            <Card key={phase.number} className={`relative ml-14 p-6 ${config.bg}`}>
              {/* Phase number bubble */}
              <div className={`absolute -left-[3.75rem] top-6 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background ${config.bg}`}>
                <Icon className={`h-6 w-6 ${config.color}`} />
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        Phase {phase.number}
                      </Badge>
                      <Badge variant="secondary">{config.badge}</Badge>
                      <Badge variant="outline">{phase.eta}</Badge>
                    </div>
                    <h3 className="text-xl font-semibold">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground italic">{phase.goal}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Tasks ({completedTasks}/{totalTasks})</h4>
                  <ul className="space-y-1">
                    {phase.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {task.done ? (
                          <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        )}
                        <span className={task.done ? "line-through text-muted-foreground" : ""}>
                          {task.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-sm font-medium">Outcomes</h4>
                  <ul className="space-y-1">
                    {phase.outcomes.map((outcome, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">→</span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
