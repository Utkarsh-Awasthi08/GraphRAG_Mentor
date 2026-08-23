export function generateMistake({ status, error }) {
    if (!status) return null;

    status = status.toLowerCase();

    
    // 🟡 1. Compile Error
    if (status.includes("compile")) {
        return "Your code failed to compile. Please check for syntax errors, missing imports, or other issues that prevent the code from running.";
    }
    function parseWrongAnswer(error) {
        if (!error) return "Wrong answer but no details found";
    
        const inputMatch = error.match(/Input:\s*(.*)/i);
        const expectedMatch = error.match(/Expected:\s*(.*)/i);
        const outputMatch = error.match(/Output:\s*(.*)/i);
    
        const input = inputMatch ? inputMatch[1] : "unknown input";
        const expected = expectedMatch ? expectedMatch[1] : "unknown";
        const output = outputMatch ? outputMatch[1] : "unknown";
    
        return `Your code failed for input ${input}. Expected output was ${expected} but your output was ${output}.`;
    }
    // 🔴 2. Wrong Answer
    if (status.includes("wrong answer")) {
        return parseWrongAnswer(error);
    }

    const exceptionMap = {
        "NullPointerException": "Null values are not handled properly somewhere.",
        "IndexOutOfBoundsException": "You are accessing an index that does not exist.",
        "ArrayIndexOutOfBoundsException": "Array index is going beyond its limit.",
        "ArithmeticException": "Possible division by zero or invalid math operation.",
        "NumberFormatException": "Invalid number conversion.",
        "StackOverflowError": "Too much recursion or infinite recursion.",
        "ClassCastException": "Invalid type casting between objects."
    };
    function parseRuntimeError(error) {
        if (!error) return "Runtime error occurred";
    
        // Extract first line (usually exception name)
        const firstLine = error.split("\n")[0];
    
        // Try to find known exception
        for (const key in exceptionMap) {
            if (firstLine.includes(key)) {
                return exceptionMap[key];
            }
        }
    
        return `Runtime error occurred: ${firstLine}`;
    }
    // ⚠️ 3. Runtime Error
    if (status.includes("runtime")) {
        return parseRuntimeError(error);
    }

    // 🟢 4. Accepted
    if (status.includes("accepted")) {
        return "Solution is correct and passed all test cases. Well done!";
    }

    // ⏱️ 5. Time Limit Exceeded
    if (status.includes("time limit exceeded")) {
        return "Your approach works but is not optimized enough. Try to find a better time complexity (e.g. O(N log N) instead of O(N^2)).";
    }

    return "Unknown mistake";
}