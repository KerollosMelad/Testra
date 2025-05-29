# AI Test Generation - Testing Guide

## Quick Test Steps

### 1. Set Up Environment
Create `.env.local` in your project root:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Start the Application
```bash
pnpm dev
```

### 3. Test the Integration

1. **Navigate to a Project**
   - Go to `http://localhost:3001` (or whatever port is shown)
   - Click on any existing project
   - Or create a new project if none exist

2. **Find a Work Item**
   - Look for User Stories, Tasks, Bugs, or Features
   - Each should have a "Generate Tests" button with a ✨ icon

3. **Generate Test Cases**
   - Click the "Generate Tests" button
   - Configure options:
     - **Test Type**: Unit, Integration, E2E, or API
     - **Coverage Level**: Basic, Comprehensive, or Custom
     - **Custom Requirements**: Add specific scenarios (optional)
   - Click "Generate Test Cases"

4. **Review Results**
   - AI will analyze the work item
   - Generated test cases will appear with:
     - Test steps and expected outcomes
     - Priority and estimated duration
     - Generated code (when applicable)
     - AI confidence score

## Troubleshooting

### Common Issues

**"OpenAI API key is not configured"**
- Add `OPENAI_API_KEY` to `.env.local`
- Restart the development server

**"Invalid parameter: response_format"**
- ✅ **FIXED**: The code now automatically detects model compatibility
- Uses structured JSON output for supported models
- Falls back to text parsing for older models

**"Failed to generate test cases"**
- Check your OpenAI API key is valid
- Ensure you have sufficient credits
- Try a different model (GPT-3.5 Turbo vs GPT-4)

### Model Compatibility

**Fully Supported (JSON Response Format)**
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo (newer versions)

**Partially Supported (Text Parsing)**
- Older GPT-3.5 Turbo models
- Other OpenAI models

## Expected Behavior

### Successful Generation
- Loading spinner during generation
- Multiple test cases generated
- Clear test steps and expected outcomes
- AI suggestions for improvement
- Confidence score (typically 70-95%)

### Fallback Mode
- When JSON parsing fails, creates basic test case
- Lower confidence score (~50%)
- Suggestions to try again or use newer model

## Testing Different Scenarios

### Test Types
1. **Unit Tests**: Component-level testing
2. **Integration Tests**: Module interaction testing  
3. **E2E Tests**: Full user workflow testing
4. **API Tests**: REST endpoint testing

### Coverage Levels
1. **Basic**: Happy path scenarios
2. **Comprehensive**: Includes edge cases
3. **Custom**: Your specific requirements

### Work Item Types
- **User Stories**: Best results (detailed acceptance criteria)
- **Tasks**: Good for specific functionality
- **Bugs**: Regression test generation
- **Features**: High-level test planning

## Performance Notes

- Generation typically takes 3-10 seconds
- Longer for comprehensive coverage
- GPT-4 is slower but more detailed
- GPT-3.5 Turbo is faster but simpler 