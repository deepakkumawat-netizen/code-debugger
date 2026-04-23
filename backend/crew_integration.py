"""Multi-agent crew integration for Code-Debugger"""
from crew import debug_code_multi_agent, debug_code_with_optimization

def handle_debugging_crew(code: str, language: str) -> dict:
    """Handle multi-agent crew request for code debugging"""
    try:
        result = debug_code_multi_agent(code, language)
        return {
            "status": "success",
            "issues_found": result["issues_found"],
            "fixed_code": result["fixed_code"],
            "explanation": result["explanation"],
            "agents_used": result.get("agents_used", ["debugger", "fixer", "explainer"])
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "agents_used": []
        }

def handle_debugging_crew_optimized(code: str, language: str) -> dict:
    """Handle multi-agent crew request with performance optimization (4 agents)"""
    try:
        result = debug_code_with_optimization(code, language, include_optimization=True)
        return {
            "status": "success",
            "issues_found": result["issues_found"],
            "fixed_code": result["fixed_code"],
            "explanation": result["explanation"],
            "performance_issues": result.get("performance_issues", ""),
            "optimized_code": result.get("optimized_code", ""),
            "agents_used": result.get("agents_used", ["debugger", "fixer", "explainer", "optimizer"])
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "agents_used": []
        }
