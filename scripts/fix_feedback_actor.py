with open('src/components/product-management/ProductManagementView.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('setFeedbackToast({', 'setFeedback({')

with open('src/components/product-management/ProductManagementView.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_c = f.read()

# Replace actor in App.tsx
import re
app_c = re.sub(
    r"actor = activeRole === 'admin' \? `Admin \(\${activeBranch}\)` : 'Admin'",
    "actor = 'Admin'",
    app_c
)
app_c = re.sub(
    r"actingUser=\{activeRole === 'admin' \? `Admin \(\${activeBranch}\)` : 'Admin'\}",
    "actingUser={'Admin'}",
    app_c
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_c)

print('Updated feedback and actor successfully!')
