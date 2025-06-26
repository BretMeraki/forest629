import { ForestServer } from "./server.js";

async function main() {
  // Create the server instance (do not start HTTP server)
  const server = new ForestServer();

  // Prepare project data (matches previous user input)
  const projectArgs = {
    project_id: "digital_marketer_2025",
    goal: "Secure a role as a digital marketer by November 2025",
    context:
      "Currently a physical security guard. Degree in psychology, UX Design certificate, spotty work history.",
    existing_credentials: [
      {
        credential_type: "Degree",
        subject_area: "Psychology",
        level: "Bachelor",
        relevance_to_goal: "Understanding human behavior for marketing",
      },
      {
        credential_type: "Certificate",
        subject_area: "UX Design",
        level: "Certificate",
        relevance_to_goal:
          "User experience and design skills for digital marketing",
      },
    ],
    life_structure_preferences: {
      wake_time: "7:00 AM",
      sleep_time: "11:00 PM",
      meal_times: ["8:00 AM", "12:00 PM", "6:00 PM"],
      break_preferences: "5 minute breaks every 25 minutes",
      focus_duration: "50 minutes",
      transition_time: "10 minutes",
    },
    urgency_level: "high",
    success_metrics: [
      "Job offer as digital marketer",
      "Portfolio of marketing projects",
      "Professional network growth",
    ],
  };

  // Try to create the project, but continue if it already exists
  try {
    await server.createProject(projectArgs);
  } catch (err) {
    if (!err.message.includes("already exists")) throw err;
    console.log("Project already exists, continuing...");
  }

  // Build the HTA tree for the general path using the new async node generation
  try {
    const learningHistory = { completed_topics: [] };
    const nodes = await server.generateSequencedFrontierNodes(
      projectArgs,
      learningHistory,
    );
    console.log("LLM-generated HTA nodes:", JSON.stringify(nodes, null, 2));
  } catch (err) {
    console.error("Error during LLM node generation:", err.message);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
