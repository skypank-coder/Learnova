import { POST } from "@/app/api/register/route";
import { connectDb } from "@/lib/mongodb";
import { put } from "@vercel/blob";

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

jest.mock("@vercel/blob", () => ({
  put: jest.fn(),
}));

jest.mock("@/lib/mongodb", () => ({
  connectDb: jest.fn(),
}));

describe("POST /api/register - Security & Validation Tests", () => {
  let mockFindOne;
  let mockInsertOne;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOne = jest.fn();
    mockInsertOne = jest.fn();

    connectDb.mockResolvedValue({
      collection: jest.fn().mockReturnValue({
        findOne: mockFindOne,
        insertOne: mockInsertOne,
      }),
    });

    put.mockResolvedValue({ url: "https://example.com/blob.jpg" });
  });

  const mockFile = {
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    type: "image/jpeg",
    size: 1024,
  };

  const createMockRequest = (data) => {
    return {
      formData: jest.fn().mockResolvedValue({
        get: (key) => data[key],
      }),
    };
  };

  test("accepts valid email and registers user successfully", async () => {
    mockFindOne.mockResolvedValue(null);
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" });

    const req = createMockRequest({
      name: "John Doe",
      rollNo: "123456",
      email: "user+tag@domain.co.uk",
      photo: mockFile,
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("user+tag@domain.co.uk");
    expect(mockInsertOne).toHaveBeenCalled();
  });

  test.each([
    ["invalid-email"],
    ["test@domain"],
    ["@domain.com"],
    ["user@domain."],
    ["user @domain.com"],
    ["user@ domain.com"],
  ])("rejects invalid email format '%s' with 400 Bad Request", async (invalidEmail) => {
    const req = createMockRequest({
      name: "John Doe",
      rollNo: "123456",
      email: invalidEmail,
      photo: mockFile,
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid email address");
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(connectDb).not.toHaveBeenCalled(); // Validation must happen before DB connection or insertion
  });

  test("rejects request if file size exceeds MAX_FILE_SIZE (5MB)", async () => {
    const oversizedFile = {
      ...mockFile,
      size: 6 * 1024 * 1024, // 6MB
    };

    const req = createMockRequest({
      name: "John Doe",
      rollNo: "123456",
      email: "user@domain.com",
      photo: oversizedFile,
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("File too large");
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(connectDb).not.toHaveBeenCalled(); // Validation must happen before DB connection or insertion
  });

  test("accepts request if file size is exactly at the limit (5MB)", async () => {
    mockFindOne.mockResolvedValue(null);
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" });

    const limitFile = {
      ...mockFile,
      size: 5 * 1024 * 1024, // 5MB
    };

    const req = createMockRequest({
      name: "John Doe",
      rollNo: "123456",
      email: "user@domain.com",
      photo: limitFile,
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockInsertOne).toHaveBeenCalled();
  });
});
