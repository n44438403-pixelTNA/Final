
export const downloadAsMHTML = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    // Clone the element to avoid modifying the live DOM
    const clone = element.cloneNode(true) as HTMLElement;

    // Helper to inline styles
    const inlineStyles = (source: HTMLElement, target: HTMLElement) => {
        const computed = window.getComputedStyle(source);
        for (let i = 0; i < computed.length; i++) {
            const key = computed[i];
            const value = computed.getPropertyValue(key);
            target.style.setProperty(key, value, computed.getPropertyPriority(key));
        }

        // Recursively inline children
        for (let i = 0; i < source.children.length; i++) {
            inlineStyles(source.children[i] as HTMLElement, target.children[i] as HTMLElement);
        }
    };

    // Note: Deep inlining styles for a large tree is very slow and heavy.
    // Instead, we will wrap the content in a basic HTML structure and rely on the fact that
    // most styles are Tailwind utility classes. If the user opens this offline, they might lose Tailwind styles
    // unless we embed the stylesheet.

    // Better Strategy for "Offline Webpage":
    // 1. Get the outerHTML of the element.
    // 2. Fetch all stylesheets from the current document.
    // 3. Embed them in a <style> tag.

    let styles = '';
    for (let i = 0; i < document.styleSheets.length; i++) {
        try {
            const sheet = document.styleSheets[i];
            if (sheet.href) {
                // External stylesheet - try to fetch logic or just link it (but link won't work offline if no net)
                // For simplicity/security in this env, we might skip external fetch or rely on what's accessible.
                // However, Vite/Tailwind often injects styles into <style> tags in dev/prod.
            } else {
                // Inline styles (Tailwind usually lives here in production builds if extracted)
                const rules = sheet.cssRules;
                for (let j = 0; j < rules.length; j++) {
                    styles += rules[j].cssText + '\n';
                }
            }
        } catch (e) {
            console.warn("Access to stylesheet blocked", e);
        }
    }

    // Get images and convert to Base64 (Optional enhancement, skipping for speed/complexity unless requested)
    // Basic approach: Just take the HTML. Most "Save as MHTML" browsers do the heavy lifting.
    // Since we are generating a file, we create a full .html file with embedded styles.

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename}</title>
    <style>
        ${styles}
        /* Basic reset/ensure visibility */
        body { background: white; color: black; font-family: sans-serif; padding: 20px; }
        .hidden-print { display: none !important; }
    </style>
</head>
<body>
    <div id="offline-content">
        ${element.outerHTML}
    </div>
    <script>
        // Remove interactive elements that won't work
        document.querySelectorAll('button').forEach(b => b.remove());
    </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`; // MHTML is complex to generate, .html with embedded styles is "Offline Webpage" standard for JS export
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
