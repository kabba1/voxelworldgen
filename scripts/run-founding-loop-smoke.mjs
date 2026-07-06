import { createServer } from "vite";

const maxTicks = Number.parseInt(process.argv[2] ?? "720", 10);
const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true }
});

try {
  const { runFoundingLoopSmoke } = await server.ssrLoadModule("/src/sim/foundingLoopSmoke.ts");
  const result = runFoundingLoopSmoke(Number.isFinite(maxTicks) ? maxTicks : 720);
  console.log(
    JSON.stringify(
      {
        passed: result.passed,
        ticks: result.ticks,
        agents: result.agentCount,
        projects: result.projectCount,
        completedGarden: result.completedGarden,
        completedHome: result.completedHome,
        gathered: result.gatheredEvents,
        deposited: result.depositedEvents,
        reserved: result.reservedEvents,
        construction: result.constructionEvents,
        producedFood: result.producedFoodEvents,
        ateFood: result.ateFoodEvents,
        tail: result.eventChain.slice(-8)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
} finally {
  await server.close();
}
