import { POST } from "@/app/api/groq/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => {
      return {
        status: init?.status || 200,
        json: async () => body,
        headers: new Map(),
      };
    }),
  },
}));

global.fetch = jest.fn();

describe("POST /api/groq - Timeout and Abort Controller Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GROQ_API_KEY = "mock-groq-key";
  });

  const createMockRequest = (bodyData) => {
    return {
      json: jest.fn().mockResolvedValue(bodyData),
    };
  };

  test("rejects missing message input with 400 Bad Request", async () => {
    const req = createMockRequest({ message: "" });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Message is required");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects over-length messages with 400 Bad Request", async () => {
    const longMessage = "a".repeat(2001);
    const req = createMockRequest({ message: longMessage });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Message is too long");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("successfully resolves Groq call for non-rate-limited requests", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "Nova's warm response!" } }],
      }),
    });

    const req = createMockRequest({ message: "Help me with attendance automation" });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Nova's warm response!");
    expect(global.fetch).toHaveBeenCalled();
  });

  test("aborts the request and returns 504 Gateway Timeout when Groq API hangs/exceeds timeout", async () => {
    // Mock fetch to simulate an AbortError being thrown
    global.fetch.mockImplementation(() => {
      const error = new Error("The user aborted a request.");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const req = createMockRequest({ message: "This request will time out" });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBe("Gateway Timeout: Groq did not respond in time.");
    expect(global.fetch).toHaveBeenCalled();
  });
});
