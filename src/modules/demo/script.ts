import type { Messages } from "@/modules/i18n/messages";

export type DemoFact = {
  key: string;
  value: string;
};

export function getDemoScript(t: Messages) {
  const facts: DemoFact[] = [
    {
      key: t.demoFactEmployeeKey,
      value: t.demoFactEmployeeValue,
    },
    {
      key: t.demoFactEmployerKey,
      value: t.demoFactEmployerValue,
    },
    {
      key: t.demoFactRoleKey,
      value: t.demoFactRoleValue,
    },
    {
      key: t.demoFactIssueKey,
      value: t.demoFactIssueValue,
    },
    {
      key: t.demoFactReliefKey,
      value: t.demoFactReliefValue,
    },
  ];

  return {
    facts,
    researchQuery: t.demoResearchQuery,
    draftTask: t.demoDraftTask,
  };
}
