import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "context7",
  version: "1.0.0",
});

// Add a tool to search for documentation
server.tool(
  "search-docs",
  {
    query: z.string().describe("Search query for documentation"),
    library: z.string().optional().describe("Specific library to search (e.g., 'react', 'nextjs')"),
    version: z.string().optional().describe("Specific version to search for"),
  },
  async ({ query, library, version }) => {
    // This is a placeholder implementation
    // In a real Context7 server, this would fetch actual documentation
    
    let result = `Documentation search results for: "${query}"`;
    
    if (library) {
      result += ` in ${library}`;
      if (version) {
        result += ` version ${version}`;
      }
    }
    
    result += `
    
Note: This is a placeholder MCP server for Context7.
In a production implementation, this would connect to documentation sources
and return relevant, up-to-date documentation snippets.`;

    return {
      content: [{ type: "text", text: result }],
    };
  }
);

// Add a resource template for accessing specific documentation
server.resource(
  "docs",
  new McpServer.ResourceTemplate("docs://{library}/{topic}", { list: undefined }),
  async (uri, { library, topic }) => {
    return {
      contents: [{
        uri: uri.href,
        text: `# ${library} Documentation: ${topic}\n\nThis is placeholder documentation content for ${library} - ${topic}.\n\nIn a real Context7 implementation, this would contain the actual, up-to-date documentation fetched from official sources.`,
      }],
    };
  }
);

// Add a prompt for getting started with a library
server.prompt(
  "getting-started",
  {
    library: z.string().describe("Library or framework to get started with"),
    version: z.string().optional().describe("Specific version"),
  },
  async ({ library, version }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `How do I get started with ${library}${version ? ` version ${version}` : ""}?`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I'll help you get started with ${library}${version ? ` version ${version}` : ""}. Let me fetch the latest getting started guide from the official documentation.`,
          },
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Context7 MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start Context7 MCP Server:", error);
  process.exit(1);
});