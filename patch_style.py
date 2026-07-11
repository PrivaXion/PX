import sys
import re

def patch_style():
    with open('style.css', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Soften contrast in variables
    content = content.replace('--text-main: #e0e0e0;', '--text-main: #cbd5e1;')
    content = content.replace('--primary: #00ffaa;', '--primary: #34d399;')
    content = content.replace('--primary-hover: #00d48c;', '--primary-hover: #10b981;')
    content = content.replace('--border-color: #262f45;', '--border-color: rgba(255, 255, 255, 0.08);')
    content = content.replace('--border-focus: #00e1ff;', '--border-focus: #38bdf8;')
    content = content.replace('--glow-effect: 0 0 15px rgba(0, 255, 170, 0.35);', '--glow-effect: 0 0 10px rgba(52, 211, 153, 0.15);')

    # Remove old hover effects with high contrast
    content = content.replace('box-shadow: 0 0 18px rgba(0, 255, 170, 0.18);', 'box-shadow: 0 0 10px rgba(52, 211, 153, 0.1);')
    content = content.replace('border: 1px solid rgba(0, 255, 170, 0.35);', 'border: 1px solid rgba(52, 211, 153, 0.2);')

    # 2. Extract and remove old @media (max-width: 768px)
    # We will just write a regex to remove the existing 768px block.
    # It starts around line 2382 and goes until the next @media or end of file.
    
    # We'll just append our new mobile rules that will override previous ones due to CSS specificity / cascade,
    # but it's cleaner to just append a massive override block at the end.
    
    mobile_css = """
/* ==========================================================================
   NEW MOBILE ADAPTATION (Full Screen Overlay)
   ========================================================================== */
@media (max-width: 768px) {
    /* Hide scrollbars for cleaner mobile look */
    ::-webkit-scrollbar { width: 0; background: transparent; }
    
    body.home-active #home-screen {
        display: block !important;
        position: relative;
        padding: 0;
        overflow: hidden;
    }

    /* Sidebar takes full screen */
    .sidebar {
        width: 100% !important;
        height: 100vh !important;
        max-height: 100vh !important;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        padding: 10px !important;
        background-color: var(--bg-color);
    }

    /* Main content overlays sidebar when active */
    .main-content {
        position: absolute;
        top: 0;
        left: 0;
        width: 100% !important;
        height: 100vh !important;
        z-index: 20;
        background-color: var(--bg-color);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        padding: 0 !important;
    }

    /* When a chat or search is active, slide it in */
    body.mobile-main-active .main-content {
        transform: translateX(0);
    }

    /* Chat header needs space for back button */
    .chat-header-bar {
        padding: 10px 12px;
        gap: 10px;
    }

    /* Hide call controls on very small screens to save space */
    .chat-call-controls .btn-call, .chat-call-controls .btn-mic {
        padding: 6px 10px;
        font-size: 11px;
    }

    /* Chat input area at the very bottom */
    .chat-input-area {
        padding: 10px;
        padding-bottom: max(10px, env(safe-area-inset-bottom));
    }
    
    .main-panel {
        border-radius: 0 !important;
        border: none !important;
    }

    .btn-mobile-back {
        display: flex !important;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.1);
        border: none;
        color: var(--text-main);
        font-size: 18px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        margin-right: 8px;
        cursor: pointer;
    }
}

/* Hide back button on desktop */
.btn-mobile-back {
    display: none;
}
"""
    if "NEW MOBILE ADAPTATION" not in content:
        content += "\n" + mobile_css

    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_style()
