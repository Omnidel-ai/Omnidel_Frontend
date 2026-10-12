import { useState } from "react";
import { BoardPage } from "./BoardPage";
import { ProjectsPage } from "./ProjectsPage";
import { ReviewPage } from "./ReviewPage";
import { TeamsPage } from "./TeamsPage";
import omnipulse from "../data/omnipulse.json";
import type { OmniPulseData } from "./types";

const PULSE = omnipulse as OmniPulseData;

export interface PulseScreenProps {
  /** The current route, e.g. `/omnipulse/projects`. */
  href: string;
  onNavigate: (href: string) => void;
}

/**
 * OmniPulse's four screens, and the navigation between them.
 *
 * Two things moved in here out of `App`, and both were in the wrong place.
 *
 * The **data**: `omnipulse.json` now loads with this module rather than with
 * the application, so someone who only opens Home never downloads a board.
 *
 * The **state**: which team narrows Projects, and which board is open. In the
 * real application those are route parameters. Here they were two `useState`s
 * in `App`, which meant the top-level component knew what a kanban board was —
 * and anyone reading `App` to learn how routing works had to read past them.
 * A module's internal navigation belongs to the module.
 */
export function PulseScreen({ href, onNavigate }: PulseScreenProps) {
  const [teamId, setTeamId] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);

  if (href === "/omnipulse/boards") {
    return (
      <TeamsPage
        data={PULSE.teams}
        onOpen={(team) => {
          setTeamId(team.id);
          onNavigate("/omnipulse/projects");
        }}
      />
    );
  }

  if (href === "/omnipulse/projects") {
    if (boardId) {
      return (
        <BoardPage
          board={PULSE.boards.find((b) => b.id === boardId) ?? PULSE.boards[0]}
          data={PULSE}
          onBack={() => setBoardId(null)}
        />
      );
    }
    return (
      <ProjectsPage
        data={PULSE.projects}
        teams={PULSE.teams.rows}
        people={PULSE.people}
        teamId={teamId}
        onTeamChange={setTeamId}
        onOpen={(project) => {
          // Only one board carries demo lists; the rest open it too rather
          // than showing an empty kanban.
          setBoardId(PULSE.boards.find((b) => b.id === project.id)?.id ?? PULSE.boards[0].id);
        }}
      />
    );
  }

  if (href === "/omnipulse/review") return <ReviewPage data={PULSE.review} />;

  return null;
}

export default PulseScreen;
