# OpenAI Integration Setup Guide

## Overview
Testra now includes AI-powered test case generation using OpenAI's GPT models. This feature allows you to automatically generate comprehensive test cases from your Azure DevOps work items.

## Prerequisites
- OpenAI API account and API key
- Existing Testra project with Azure DevOps integration

## Setup Instructions

### 1. Get OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (starts with `sk-`)

### 2. Configure Environment Variables
Create a `.env.local` file in your project root with the following:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration (if not already set)
DATABASE_URL="postgresql://postgres:password@localhost:5432/testra"
```

### 3. Restart Development Server
After adding the environment variables, restart your development server:

```bash
pnpm dev
```

## Features

### AI Test Generation
- **Smart Analysis**: AI analyzes user stories, acceptance criteria, and related tasks
- **Multiple Test Types**: Generate unit, integration, e2e, or API tests
- **Coverage Levels**: Choose between basic, comprehensive, or custom coverage
- **Code Generation**: Automatically generates test code for supported frameworks
- **Relationship Mapping**: Links generated tests to work items

### Supported Models
- **GPT-4**: Most capable, best for complex scenarios
- **GPT-4 Turbo**: Faster and more cost-effective
- **GPT-3.5 Turbo**: Quick and efficient for simpler test cases

### Test Generation Options
1. **Test Type**:
   - Unit Tests: Component/function level testing
   - Integration Tests: Module interaction testing
   - End-to-End Tests: Full user workflow testing
   - API Tests: REST API endpoint testing

2. **Coverage Level**:
   - Basic: Essential happy path scenarios
   - Comprehensive: Includes edge cases and error conditions
   - Custom: Specify your own requirements

## Usage

### From Work Items List
1. Navigate to your project
2. Find the work item you want to generate tests for
3. Click the "Generate Tests" button
4. Configure test generation options
5. Review and save generated test cases

### Configuration Options
- **Test Type**: Select the type of tests to generate
- **Coverage Level**: Choose how comprehensive the tests should be
- **Custom Requirements**: Add specific scenarios or edge cases
- **AI Model**: Use project default or override with specific model

## Best Practices

### For Better Results
1. **Clear Acceptance Criteria**: Ensure work items have detailed acceptance criteria
2. **Descriptive Titles**: Use clear, descriptive titles for work items
3. **Related Tasks**: Link related tasks to provide more context
4. **Custom Requirements**: Be specific about edge cases or special scenarios

### Cost Management
1. **Choose Appropriate Models**: Use GPT-3.5 for simpler scenarios
2. **Optimize Coverage**: Start with basic coverage and iterate
3. **Review Before Generating**: Ensure work items are well-defined

## Troubleshooting

### Common Issues

#### "OpenAI API key is not configured"
- Ensure `OPENAI_API_KEY` is set in `.env.local`
- Restart the development server
- Check that the API key is valid and active

#### "Invalid OpenAI API key"
- Verify the API key is correct
- Check if the API key has sufficient credits
- Ensure the API key has the necessary permissions

#### "OpenAI API quota exceeded"
- Check your OpenAI usage limits
- Upgrade your OpenAI plan if needed
- Wait for quota reset if on free tier

### API Limits
- **Rate Limits**: OpenAI has rate limits based on your plan
- **Token Limits**: Each model has maximum token limits per request
- **Monthly Quotas**: Free tier has monthly usage limits

## Security Notes

### Environment Variables
- Never commit `.env.local` to version control
- Use different API keys for development and production
- Regularly rotate API keys for security

### Data Privacy
- Work item data is sent to OpenAI for processing
- Ensure compliance with your organization's data policies
- Consider using Azure OpenAI for enterprise compliance

## Support

For issues related to:
- **OpenAI API**: Check [OpenAI Documentation](https://platform.openai.com/docs)
- **Testra Integration**: Create an issue in the project repository
- **Azure DevOps**: Verify your Azure DevOps connection and permissions 