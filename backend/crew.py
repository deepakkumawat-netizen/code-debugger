"""Multi-agent system for Code-Debugger - code analysis coordination"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class Agent:
    def __init__(self, role: str, goal: str):
        self.role = role
        self.goal = goal
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def execute(self, task: str) -> str:
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"You are a {self.role}. Goal: {self.goal}"},
                {"role": "user", "content": task}
            ],
            max_tokens=1500,
            temperature=0.7
        )
        return response.choices[0].message.content

def debug_code_multi_agent(code: str, language: str) -> dict:
    """Coordinate multiple agents for comprehensive code debugging"""

    debugger_agent = Agent("Code Debugger", "Find and diagnose code issues")
    fixer_agent = Agent("Solution Developer", "Create fixes for code problems")
    explainer_agent = Agent("Code Explainer", "Explain errors and solutions clearly")

    # Debug task
    debug_prompt = f"Analyze this {language} code for bugs:\n\n{code}\n\nList all issues found."
    issues = debugger_agent.execute(debug_prompt)

    # Fix task
    fix_prompt = f"Provide corrected code for these issues:\n{issues}\n\nOriginal code:\n{code}"
    fixed_code = fixer_agent.execute(fix_prompt)

    # Explanation task
    explain_prompt = f"Explain these bugs and fixes in simple terms:\n{issues}"
    explanation = explainer_agent.execute(explain_prompt)

    return {
        "issues_found": issues,
        "fixed_code": fixed_code,
        "explanation": explanation,
        "agents_used": ["debugger", "fixer", "explainer"]
    }

def debug_code_with_optimization(code: str, language: str, include_optimization: bool = True) -> dict:
    """Enhanced debugging with performance optimization agent"""

    debugger_agent = Agent("Code Debugger", "Find and diagnose code issues")
    fixer_agent = Agent("Solution Developer", "Create fixes for code problems")
    explainer_agent = Agent("Code Explainer", "Explain errors and solutions clearly")
    optimizer_agent = Agent("Performance Optimizer", "Identify performance bottlenecks and suggest optimizations")

    # Debug task
    debug_prompt = f"Analyze this {language} code for bugs:\n\n{code}\n\nList all issues found."
    issues = debugger_agent.execute(debug_prompt)

    # Fix task
    fix_prompt = f"Provide corrected code for these issues:\n{issues}\n\nOriginal code:\n{code}"
    fixed_code = fixer_agent.execute(fix_prompt)

    # Explanation task
    explain_prompt = f"Explain these bugs and fixes in simple terms:\n{issues}"
    explanation = explainer_agent.execute(explain_prompt)

    response = {
        "issues_found": issues,
        "fixed_code": fixed_code,
        "explanation": explanation,
        "agents_used": ["debugger", "fixer", "explainer"]
    }

    # Performance optimization task (NEW)
    if include_optimization:
        optimize_prompt = f"""Analyze this {language} code for performance issues:

{fixed_code}

Identify:
1. Bottlenecks (slow operations)
2. Inefficient algorithms
3. Memory waste
4. Unnecessary computations

Provide specific, actionable improvements."""

        performance_issues = optimizer_agent.execute(optimize_prompt)

        # Generate optimized code
        optimize_code_prompt = f"""Rewrite this {language} code to be faster and more efficient:

{fixed_code}

Keep the same functionality but improve performance. Show the optimized version."""

        optimized_code = optimizer_agent.execute(optimize_code_prompt)

        response["performance_issues"] = performance_issues
        response["optimized_code"] = optimized_code
        response["agents_used"].append("optimizer")

    return response
