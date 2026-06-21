"""
A smarter JS syntax checker that correctly handles:
- Template literals (backtick strings) with ${...} expressions
- Regular string literals
- Nested structures
"""

def check_js(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    i = 0
    n = len(content)
    # Stack entries: ('bracket_type', line_num)
    stack = []
    line_num = 1
    
    # Track string context: None, 'single', 'double', 'template'
    # For template literals, we need to handle ${...} nesting
    string_ctx = []  # stack of string contexts

    while i < n:
        ch = content[i]
        
        if ch == '\n':
            line_num += 1
            i += 1
            continue

        # Handle escape sequences
        if string_ctx and string_ctx[-1] in ('single', 'double', 'template'):
            if ch == '\\':
                i += 2  # skip escaped char
                continue

        # If we're inside a regular string (not template literal)
        if string_ctx and string_ctx[-1] == 'single':
            if ch == "'":
                string_ctx.pop()
            i += 1
            continue

        if string_ctx and string_ctx[-1] == 'double':
            if ch == '"':
                string_ctx.pop()
            i += 1
            continue

        if string_ctx and string_ctx[-1] == 'template':
            if ch == '`':
                string_ctx.pop()
            elif ch == '$' and i + 1 < n and content[i+1] == '{':
                # Enter template expression
                string_ctx.append('template_expr')
                stack.append(('{', line_num))
                i += 2
                continue
            i += 1
            continue

        # Inside template expression - treat like normal code but with nested tracking
        # The stack already handles {}
        
        # Start of strings
        if ch == "'":
            string_ctx.append('single')
            i += 1
            continue
        if ch == '"':
            string_ctx.append('double')
            i += 1
            continue
        if ch == '`':
            string_ctx.append('template')
            i += 1
            continue

        # Line comments
        if ch == '/' and i + 1 < n and content[i+1] == '/':
            while i < n and content[i] != '\n':
                i += 1
            continue

        # Block comments
        if ch == '/' and i + 1 < n and content[i+1] == '*':
            i += 2
            while i + 1 < n and not (content[i] == '*' and content[i+1] == '/'):
                if content[i] == '\n':
                    line_num += 1
                i += 1
            i += 2
            continue

        # Bracket tracking (only outside strings and comments)
        if ch in ('(', '{', '['):
            # Don't track { inside template expressions (already tracked above)
            if not (string_ctx and string_ctx[-1] == 'template_expr' and ch == '{'):
                stack.append((ch, line_num))
        elif ch in (')', '}', ']'):
            mapping = {')': '(', '}': '{', ']': '['}
            if ch == '}' and string_ctx and string_ctx[-1] == 'template_expr':
                # Closing template expression
                string_ctx.pop()
                if stack and stack[-1][0] == '{':
                    stack.pop()
            elif not stack:
                print(f"  FAIL: Extra closing '{ch}' at line {line_num}")
            else:
                top_ch, top_line = stack[-1]
                if mapping[ch] != top_ch:
                    print(f"  FAIL: Mismatched '{ch}' at line {line_num} (expected closing for '{top_ch}' from line {top_line})")
                else:
                    stack.pop()

        i += 1

    if stack:
        for bch, bline in stack[-5:]:  # show last 5 unclosed
            print(f"  FAIL: Unclosed '{bch}' from line {bline}")
        print(f"  FAIL: {len(stack)} unclosed bracket(s) in {filename}")
        return False
    else:
        print(f"  OK: {filename}")
        return True

print("=== JS Bracket Check ===")
r1 = check_js('player-app/app.js')
r2 = check_js('player-app/store.js')
r3 = check_js('player-app/engine.js')

if r1 and r2 and r3:
    print("\nALL PASS - no syntax bracket errors found!")
else:
    print("\nERRORS FOUND - check above output.")

