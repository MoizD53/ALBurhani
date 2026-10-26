with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'actor = activeRole' in line:
        new_lines.append("    actor = 'Admin'\n")
    elif 'actingUser={activeRole' in line:
        new_lines.append('              actingUser="Admin"\n')
    else:
        new_lines.append(line)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Cleaned up line 1261 and 1981 in App.tsx')
