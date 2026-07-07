import { NextRequest, NextResponse } from "next/server";
import { testOpenAIConnection } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
    }

    const result = await testOpenAIConnection(apiKey);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing OpenAI connection:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      },
      { status: 500 }
    );
  }
} 