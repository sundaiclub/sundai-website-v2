export type HackerSelectionOption = {
  id: string;
  name: string;
  email?: string | null;
};

export type HackerTeamMember = HackerSelectionOption & {
  role: string;
};
