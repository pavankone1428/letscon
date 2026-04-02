// ─── GLOBALS ───
let currentChatUserId = null;
let currentCommentPostId = null;
let emojiPickerTimeout = null;

// ─── INIT ───
document.addEventListener('DOMContentLoaded', initApp);

// ─── THEME ───
function initTheme() {
    const saved = localStorage.getItem('refnet-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeDots(saved);
}
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('refnet-theme', theme);
    updateThemeDots(theme);
}
function updateThemeDots(theme) {
    document.querySelectorAll('.theme-dot').forEach(d => {
        d.classList.toggle('active-theme', d.dataset.theme === theme);
    });
}
initTheme();

function initApp() {
    document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => switchTab(b, 'desktop')));
    document.querySelectorAll('.bnav-item').forEach(b => b.addEventListener('click', () => switchTab(b, 'mobile')));

    document.querySelectorAll('.net-tab').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.net-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.net-section').forEach(s => s.classList.remove('active'));
        b.classList.add('active');
        document.getElementById('net' + capitalize(b.dataset.net)).classList.add('active');
        if (b.dataset.net === 'people') loadPeople();
        else if (b.dataset.net === 'pending') loadPendingRequests();
        else loadMyConnections();
    }));

    document.querySelectorAll('.ref-tab').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.ref-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ref-section').forEach(s => s.classList.remove('active'));
        b.classList.add('active');
        document.getElementById('ref' + capitalize(b.dataset.ref)).classList.add('active');
        if (b.dataset.ref === 'browse') loadReferralRequests();
        else loadMyReferrals();
    }));

    const searchToggle = document.getElementById('searchToggle');
    if (searchToggle) searchToggle.addEventListener('click', () => {
        document.getElementById('searchOverlay').classList.add('open');
        setTimeout(() => document.getElementById('searchInput').focus(), 100);
    });
    const searchBack = document.getElementById('searchBack');
    if (searchBack) searchBack.addEventListener('click', closeSearch);
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 300));

    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) avatarBtn.addEventListener('click', openSidebar);
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebarFn);
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.addEventListener('click', closeSidebarFn);

    const notifBtn = document.getElementById('notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', () => { switchTabByName('notifications'); loadNotifications(); });

    const feedSort = document.getElementById('feedSort');
    if (feedSort) feedSort.addEventListener('change', loadFeed);

    const chatInput = document.getElementById('inlineChatInput');
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    const commentInput = document.getElementById('commentInput');
    if (commentInput) commentInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitComment(); });
    const storyReplyInput = document.getElementById('storyReplyInput');
    if (storyReplyInput) storyReplyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendStoryReply(); });

    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.like-btn')) {
            document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
        }
        if (!e.target.closest('.custom-select')) {
            document.querySelectorAll('.custom-select.open').forEach(s => s.classList.remove('open'));
        }
        if (!e.target.closest('.post-more-wrap')) {
            document.querySelectorAll('.post-menu').forEach(m => m.classList.remove('open'));
        }
        if (!e.target.closest('.chat-plus-wrap')) {
            closeChatPlusMenu();
        }
        if (!e.target.closest('.chat-emoji-picker') && !e.target.closest('.chat-icon-btn')) {
            const ep = document.getElementById('chatEmojiPicker');
            if (ep) ep.style.display = 'none';
        }
    });

    loadFeed();
    loadStories();
    loadPublicFeed();
    checkNotifications();
    setInterval(checkNotifications, 30000);
}

// ─── TAB SWITCHING ───
function switchTab(btn, source) {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const matchD = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    const matchM = document.querySelector(`.bnav-item[data-tab="${tab}"]`);
    if (matchD) matchD.classList.add('active');
    if (matchM) matchM.classList.add('active');
    const tabEl = document.getElementById(tab + 'Tab');
    if (tabEl) tabEl.classList.add('active');
    if (tab === 'feed') loadFeed();
    if (tab === 'network') loadPeople();
    if (tab === 'referrals') loadReferralRequests();
    if (tab === 'messages') { showConvoView(); loadConversations(); }
    if (tab === 'insights') loadReviews();
    if (tab === 'notifications') loadNotifications();
    if (tab === 'profile') loadProfile();
}

function switchTabByName(name) {
    const btn = document.querySelector(`.nav-item[data-tab="${name}"]`) || document.querySelector(`.bnav-item[data-tab="${name}"]`);
    if (btn) switchTab(btn, 'code');
    else {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const el = document.getElementById(name + 'Tab');
        if (el) el.classList.add('active');
    }
}

function goTab(name) { closeSidebarFn(); switchTabByName(name); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── FEED ───
function getReactionEmoji(reaction) {
    const map = { like: '👍', love: '❤️', wow: '😮', super: '🔥', clap: '👏' };
    return map[reaction] || '👍';
}

function getReactionSummary(reactions) {
    if (!reactions) return '';
    const entries = Object.entries(reactions).filter(([,v]) => v > 0);
    if (entries.length === 0) return '';
    return entries.map(([r, c]) => `${getReactionEmoji(r)} ${c}`).join(' ');
}

async function loadFeed() {
    const sort = document.getElementById('feedSort')?.value || 'latest';
    const list = document.getElementById('feedList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    try {
        const res = await fetch(`/api/posts?sort=${sort}`);
        const posts = await res.json();
        if (posts.error) { list.innerHTML = ''; return; }
        if (posts.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No posts yet. Be the first to share!</p></div>';
            return;
        }
        list.innerHTML = posts.map(p => {
            const avatarLetter = (p.username || 'U')[0].toUpperCase();
            const reactionSummary = getReactionSummary(p.reactions);
            const userReaction = p.user_reaction || 'like';
            const totalLikes = p.upvotes || 0;
            return `
            <div class="post-card" id="post-${p.id}">
                <div class="post-header">
                    <div class="post-avatar" onclick="viewUserProfile(${p.user_id})">${avatarLetter}</div>
                    <div class="post-author-info">
                        <span class="post-author-name" onclick="viewUserProfile(${p.user_id})">${esc(p.username)}</span>
                        <span class="post-author-detail">${esc(p.company || '')} ${p.role ? '· ' + esc(p.role) : ''} · ${timeAgo(p.created_at)}</span>
                    </div>
                    <span class="post-type ${p.type}">${p.type === 'problem' ? '🔴 Problem' : p.type === 'solution' ? '🟢 Solution' : p.type === 'achievement' ? '🏆 Achievement' : '🔵 Discussion'}</span>
                </div>
                <h3>${esc(p.title)}</h3>
                <div class="post-body">${esc(p.content).substring(0, 300)}${p.content.length > 300 ? '...' : ''}</div>
                ${p.tags ? `<div class="post-tags">${p.tags.split(',').map(t => `<span class="tag">#${t.trim()}</span>`).join('')}</div>` : ''}
                ${reactionSummary ? `<div class="reaction-summary">${reactionSummary}</div>` : ''}
                <div class="post-actions-bar">
                    <button class="post-action-btn like-btn ${p.user_vote === 1 ? 'liked' : ''}" onclick="vote(${p.id}, 1, '${userReaction}')" oncontextmenu="showEmojiPicker(event, ${p.id})" ontouchstart="startLongPress(event, ${p.id})" ontouchend="cancelLongPress()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        Like ${totalLikes > 0 ? totalLikes : ''}
                    </button>
                    <button class="post-action-btn ${p.user_vote === -1 ? 'disliked' : ''}" onclick="vote(${p.id}, -1)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                        Dislike
                    </button>
                    <button class="post-action-btn" onclick="openComments(${p.id})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ${p.comment_count ? p.comment_count + ' Comments' : 'Comment'}
                    </button>
                    <button class="post-action-btn" onclick="sharePost(${p.id}, '${esc(p.title)}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <div class="post-more-wrap">
                        <button class="post-action-btn" onclick="togglePostMenu(${p.id})">⋯</button>
                        <div class="post-menu" id="postMenu-${p.id}">
                            ${p.is_own ? `<button onclick="event.stopPropagation();deletePost(${p.id})">🗑️ Delete</button>` : `<button onclick="event.stopPropagation();openReportModal('post', ${p.id})">⚠️ Report</button>`}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch { list.innerHTML = '<p style="color:#dc3545;text-align:center;">Failed to load feed</p>'; }
}

function startLongPress(e, postId) {
    emojiPickerTimeout = setTimeout(() => {
        e.preventDefault();
        showEmojiPickerAt(e.touches[0].clientX, e.touches[0].clientY, postId);
    }, 500);
}
function cancelLongPress() { clearTimeout(emojiPickerTimeout); }

function showEmojiPicker(e, postId) {
    e.preventDefault();
    showEmojiPickerAt(e.clientX, e.clientY, postId);
}

function showEmojiPickerAt(x, y, postId) {
    document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    const emojis = [
        { reaction: 'like', emoji: '👍', label: 'Like' },
        { reaction: 'love', emoji: '❤️', label: 'Love' },
        { reaction: 'wow', emoji: '😮', label: 'Wow' },
        { reaction: 'super', emoji: '🔥', label: 'Super' },
        { reaction: 'clap', emoji: '👏', label: 'Clap' }
    ];
    picker.innerHTML = emojis.map(e =>
        `<button class="emoji-option" onclick="vote(${postId}, 1, '${e.reaction}')" title="${e.label}">${e.emoji}</button>`
    ).join('');
    // Position near the button
    const postEl = document.getElementById('post-' + postId);
    if (postEl) {
        postEl.style.position = 'relative';
        picker.style.position = 'absolute';
        picker.style.bottom = '60px';
        picker.style.left = '0';
        postEl.appendChild(picker);
    }
}

async function vote(postId, v, reaction) {
    reaction = reaction || (v === 1 ? 'like' : 'dislike');
    document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
    await fetch(`/api/posts/${postId}/vote`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({vote:v, reaction:reaction}) });
    loadFeed();
}

async function bookmark(postId) {
    await fetch(`/api/posts/${postId}/bookmark`, { method:'POST' });
    loadFeed();
}

function sharePost(postId, title) {
    const url = window.location.origin + '/#post-' + postId;
    if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => alert('Link: ' + url));
    }
}

async function deletePost(postId) {
    const ok = await customConfirm('Delete this post? This cannot be undone.');
    if (!ok) return;
    try {
        const res = await fetch(`/api/posts/${postId}`, { method:'DELETE' });
        const data = await res.json();
        if (res.ok) { loadFeed(); } else { alert(data.error || 'Failed to delete'); }
    } catch { alert('Failed to delete post'); }
}

function togglePostMenu(postId) {
    const menu = document.getElementById('postMenu-' + postId);
    document.querySelectorAll('.post-menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu.classList.toggle('open');
}

async function deleteStory(storyId) {
    const ok = await customConfirm('Delete this story?');
    if (!ok) return;
    try {
        const res = await fetch(`/api/stories/${storyId}`, { method:'DELETE' });
        if (res.ok) {
            closeModal('storyViewModal');
            loadStories();
        } else { showToast('Failed to delete story'); }
    } catch { showToast('Failed to delete story'); }
}

function openCreatePost() {
    document.getElementById('postModal').classList.add('open');
    document.querySelectorAll('.type-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            opt.querySelector('input').checked = true;
        };
    });
}

async function submitPost() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const typeRadio = document.querySelector('input[name="postType"]:checked');
    const type = typeRadio ? typeRadio.value : 'problem';
    const tags = document.getElementById('postTags').value.trim();
    if (!title || !content) { alert('Title and content required'); return; }
    await fetch('/api/posts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title, content, type, tags}) });
    closeModal('postModal');
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postTags').value = '';
    loadFeed();
}

// ─── COMMENTS ───
let commentReplyToId = null;

function openComments(postId) {
    currentCommentPostId = postId;
    commentReplyToId = null;
    document.getElementById('commentReplyPreview').style.display = 'none';
    document.getElementById('commentsSheet').classList.add('open');
    loadComments(postId);
}

function closeCommentsSheet() {
    document.getElementById('commentsSheet').classList.remove('open');
    commentReplyToId = null;
}

async function loadComments(postId) {
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">Loading...</p>';
    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const comments = await res.json();
        const parents = comments.filter(c => !c.parent_id);
        const replies = {};
        comments.filter(c => c.parent_id).forEach(c => {
            if (!replies[c.parent_id]) replies[c.parent_id] = [];
            replies[c.parent_id].push(c);
        });
        document.getElementById('commentsTitle').textContent = `Comments (${comments.length})`;
        if (comments.length === 0 || parents.length === 0) { list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">No comments yet. Be the first! 💬</p>'; return; }
    list.innerHTML = parents.map(c => {
        const childReplies = replies[c.id] || [];
        return renderComment(c) + (childReplies.length > 0 ? `
            <div class="replies-toggle" onclick="toggleReplies(${c.id}, this)">
                <span>▸ View ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}</span>
            </div>
            <div class="replies-list" id="replies-${c.id}" style="display:none;">
                ${childReplies.map(r => renderComment(r, true)).join('')}
            </div>` : '');
    }).join('');
    } catch { list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">No comments yet. Be the first! 💬</p>'; }
}

function renderComment(c, isReply) {
    const letter = (c.username || 'U')[0].toUpperCase();
    return `
    <div class="comment-item ${isReply ? 'comment-reply' : ''}" id="comment-${c.id}">
        <div class="comment-top">
            <div class="comment-avatar">${letter}</div>
            <div class="comment-meta">
                <span class="comment-author">${esc(c.username)}</span>
                <span class="comment-company">${c.company ? ' · ' + esc(c.company) : ''}</span>
            </div>
            <span class="comment-time">${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-text">${esc(c.content)}</div>
        <div class="comment-actions">
            <button class="comment-action-btn ${c.user_vote === 1 ? 'c-liked' : ''}" onclick="voteComment(${c.id}, 1)">👍 ${c.likes || ''}</button>
            <button class="comment-action-btn ${c.user_vote === -1 ? 'c-disliked' : ''}" onclick="voteComment(${c.id}, -1)">👎 ${c.dislikes || ''}</button>
            <button class="comment-action-btn" onclick="replyToComment(${c.id}, '${esc(c.username)}')">↩ Reply</button>
            ${c.is_own ? `<button class="comment-action-btn comment-delete-btn" onclick="deleteComment(${c.id})">🗑️</button>` : ''}
        </div>
    </div>`;
}

function toggleReplies(commentId, btn) {
    const repliesList = document.getElementById('replies-' + commentId);
    if (repliesList.style.display === 'none') {
        repliesList.style.display = 'block';
        btn.querySelector('span').textContent = btn.querySelector('span').textContent.replace('▸ View', '▾ Hide');
    } else {
        repliesList.style.display = 'none';
        btn.querySelector('span').textContent = btn.querySelector('span').textContent.replace('▾ Hide', '▸ View');
    }
}

async function voteComment(commentId, vote) {
    await fetch(`/api/comments/${commentId}/vote`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({vote}) });
    loadComments(currentCommentPostId);
}

function replyToComment(commentId, username) {
    commentReplyToId = commentId;
    document.getElementById('commentReplyName').textContent = `Replying to ${username}`;
    document.getElementById('commentReplyPreview').style.display = 'block';
    document.getElementById('commentInput').focus();
}

function cancelCommentReply() {
    commentReplyToId = null;
    document.getElementById('commentReplyPreview').style.display = 'none';
}

async function deleteComment(commentId) {
    const ok = await customConfirm('Delete this comment?');
    if (!ok) return;
    await fetch(`/api/comments/${commentId}`, { method:'DELETE' });
    loadComments(currentCommentPostId);
    loadFeed();
}

async function submitComment() {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content || !currentCommentPostId) return;
    const body = { content };
    if (commentReplyToId) body.parent_id = commentReplyToId;
    await fetch(`/api/posts/${currentCommentPostId}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    input.value = '';
    cancelCommentReply();
    loadComments(currentCommentPostId);
    loadFeed();
}

// ─── NETWORK / CONNECTIONS ───
async function loadPeople() {
    const list = document.getElementById('peopleList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    try {
        const res = await fetch('/api/people');
        const people = await res.json();
        if (people.error) { list.innerHTML = ''; return; }
        if (people.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No users found</p></div>';
            return;
        }
        list.innerHTML = people.map(u => `
            <div class="person-card">
                <div class="person-avatar">${(u.username || 'U')[0].toUpperCase()}</div>
                <div class="person-info">
                    <div class="person-name">${esc(u.username)}</div>
                    <div class="person-detail">${esc(u.company || '')} ${u.role ? '· ' + esc(u.role) : ''}</div>
                    ${u.skills ? `<div class="person-skills">${u.skills.split(',').slice(0,3).map(s => `<span class="tag">${s.trim()}</span>`).join('')}</div>` : ''}
                </div>
                <div class="person-action" style="display:flex;gap:0.5rem;">
                    <button class="btn-outline btn-sm" onclick="viewUserProfile(${u.id})">View</button>
                    ${u.connection_status === null ? `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id}, this)">Connect</button>` :
                      u.connection_status === 'pending' && u.is_sender ? `<button class="btn-outline btn-sm" disabled>⏳ Pending</button>` :
                      u.connection_status === 'pending' && !u.is_sender ? `<button class="btn-primary btn-sm btn-accent" onclick="acceptFromNotif(${u.id})">Accept</button>` :
                      u.connection_status === 'accepted' ? `<button class="btn-primary btn-sm" onclick="openChat(${u.id}, '${esc(u.username)}')">Message</button>` :
                      `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id}, this)">Connect</button>`}
                </div>
            </div>
        `).join('');
    } catch { list.innerHTML = '<p style="color:#dc3545;text-align:center;">Failed to load</p>'; }
}

async function sendRequest(userId, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Sending...'; }
    try {
        await fetch('/api/connections/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({receiver_id:userId}) });
        if (btn) { btn.innerHTML = '✓ Request Sent'; btn.classList.remove('btn-primary'); btn.classList.add('btn-outline'); }
        else loadPeople();
    } catch {
        if (btn) { btn.innerHTML = 'Connect'; btn.disabled = false; }
    }
    loadPeople();
}

async function loadPendingRequests() {
    const list = document.getElementById('pendingList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/connections/pending');
    const reqs = await res.json();
    if (reqs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📬</div><p>No pending requests</p></div>';
        return;
    }
    list.innerHTML = reqs.map(r => `
        <div class="person-card">
            <div class="person-avatar">${r.username[0].toUpperCase()}</div>
            <div class="person-info">
                <div class="person-name">${esc(r.username)}</div>
                <div class="person-detail">${esc(r.company || '')} ${r.role ? '· ' + esc(r.role) : ''}</div>
            </div>
            <div class="person-action" style="display:flex;gap:0.5rem;">
                <button class="btn-primary btn-sm btn-accent" onclick="respondConnection(${r.id}, 'accept')">Accept</button>
                <button class="btn-outline btn-sm" onclick="respondConnection(${r.id}, 'reject')">Reject</button>
            </div>
        </div>
    `).join('');
}

async function respondConnection(connId, action) {
    await fetch('/api/connections/respond', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({connection_id:connId, action:action}) });
    loadPendingRequests();
    loadPeople();
}

async function loadMyConnections() {
    const list = document.getElementById('myConnectionsList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/connections');
    const conns = await res.json();
    if (conns.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No connections yet. Start connecting!</p></div>';
        return;
    }
    list.innerHTML = `<div class="connections-count">${conns.length} Connection${conns.length !== 1 ? 's' : ''}</div>` +
    conns.map(c => `
        <div class="person-card">
            <div class="person-avatar">${c.username[0].toUpperCase()}</div>
            <div class="person-info">
                <div class="person-name clickable" onclick="openChat(${c.id}, '${esc(c.username)}')">${esc(c.username)}</div>
                <div class="person-detail">${esc(c.company || '')} ${c.role ? '· ' + esc(c.role) : ''}</div>
            </div>
            <div class="person-action" style="display:flex;gap:0.5rem;">
                <button class="btn-outline btn-sm" onclick="viewUserProfile(${c.id})">View</button>
                <button class="btn-primary btn-sm" onclick="openChat(${c.id}, '${esc(c.username)}')">Message</button>
            </div>
        </div>
    `).join('');
}

// ─── VIEW USER PROFILE (FULL PAGE) ───
async function viewUserProfile(userId) {
    const res = await fetch(`/api/users/${userId}`);
    const u = await res.json();
    if (u.error) { alert(u.error); return; }

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const profileTab = document.getElementById('profileTab');
    if (profileTab) profileTab.classList.add('active');

    const container = document.getElementById('profileContent');
    const avatarLetter = (u.username || 'U')[0].toUpperCase();
    const isStudent = u.account_type === 'student';
    const workHistory = u.work_history || [];
    const education = u.education || [];
    const projects = u.projects || [];
    const certs = u.certifications || [];
    const accomplishments = u.accomplishments || [];
    const internships = u.internships || [];

    let html = `
        <div class="user-profile-page">
            <div class="profile-banner">
                <button class="profile-back-btn" onclick="loadProfile()">← Back</button>
                <div class="banner-gradient"></div>
                <div class="banner-avatar">${avatarLetter}</div>
            </div>
            <div class="profile-card" style="border-top:none;border-radius:0 0 0.5rem 0.5rem;padding-top:4rem;">
                <div style="text-align:center;">
                    <h2 style="font-size:1.4rem;margin-bottom:0.15rem;">${esc(u.username)}</h2>
                    ${u.headline ? `<div style="font-size:0.95rem;margin-bottom:0.15rem;">${esc(u.headline)}</div>` : ''}
                    ${isStudent
                        ? `<div class="company-role">🎓 ${esc(u.degree_pursuing || 'Student')} ${u.college ? 'at ' + esc(u.college) : ''}</div>`
                        : `<div class="company-role">${esc(u.company || '')} ${u.role ? '· ' + esc(u.role) : ''}</div>`}
                    ${u.location ? `<div style="color:#999;font-size:0.85rem;">📍 ${esc(u.location)}</div>` : ''}
                    ${u.tagline ? `<div style="color:var(--accent);font-size:0.85rem;font-style:italic;margin-top:0.25rem;">"${esc(u.tagline)}"</div>` : ''}
                    <div class="profile-stats" style="justify-content:center;margin-top:0.75rem;">
                        <div class="pstat" style="cursor:pointer;" onclick="showUserConnections(${u.id})"><div class="num">${u.connections_count || 0}</div><div class="lbl">Connections</div></div>
                        <div class="pstat" style="cursor:pointer;" onclick="showUserPosts(${u.id})"><div class="num">${u.posts_count || 0}</div><div class="lbl">Posts</div></div>
                    </div>
                    ${u.is_restricted ? '<div style="color:#f59e0b;font-size:0.85rem;margin-top:0.5rem;">🔒 Private profile — connect to see full details</div>' : ''}
                </div>
                <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;">
                    ${u.is_connected ? `<button class="btn-primary btn-sm" onclick="openChat(${u.id}, '${esc(u.username)}')">💬 Message</button>` : ''}
                    ${u.connection_status === 'accepted' ? '' :
                      u.connection_status === 'pending' && u.is_sender ? `<button class="btn-outline btn-sm" disabled>⏳ Request Sent</button>` :
                      u.connection_status === 'pending' && !u.is_sender ? `<button class="btn-primary btn-sm btn-accent" onclick="acceptFromNotif(${u.id})">Accept Request</button>` :
                      `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id}, this)">+ Connect</button>`}
                </div>
            </div>`;

    if (!u.is_restricted) {
        html += `
        ${u.bio ? `<div class="profile-section"><div class="profile-section-header"><span>🧑 About</span></div><p style="line-height:1.5;color:var(--text-secondary);">${esc(u.bio)}</p></div>` : ''}
        ${u.skills ? `<div class="profile-section"><div class="profile-section-header"><span>🛠️ Expertise</span></div><div class="profile-skills">${u.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('')}</div></div>` : ''}
        ${workHistory.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>💼 Work Journey</span></div>${workHistory.map(w => `<div class="profile-entry"><div class="entry-title">${esc(w.title||'')} ${w.company?'at '+esc(w.company):''}</div><div class="entry-meta">${esc(w.period||'')}</div>${w.description?`<div class="entry-desc">${esc(w.description)}</div>`:''}</div>`).join('')}</div>` : ''}
        ${internships.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>🏢 Internships</span></div>${internships.map(w => `<div class="profile-entry"><div class="entry-title">${esc(w.title||'')} at ${esc(w.company||'')}</div><div class="entry-meta">${esc(w.period||'')}</div>${w.description?`<div class="entry-desc">${esc(w.description)}</div>`:''}</div>`).join('')}</div>` : ''}
        ${education.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>🎓 Learning Path</span></div>${education.map(e => `<div class="profile-entry"><div class="entry-title">${esc(e.degree||'')} ${e.field?'— '+esc(e.field):''}</div><div class="entry-meta">${esc(e.institution||'')} ${e.year?'· '+esc(e.year):''}</div></div>`).join('')}</div>` : ''}
        ${projects.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>🚀 Projects</span></div>${projects.map(pr => `<div class="profile-entry"><div class="entry-title">${esc(pr.name||'')}</div>${pr.description?`<div class="entry-desc">${esc(pr.description)}</div>`:''}</div>`).join('')}</div>` : ''}
        ${certs.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>📜 Credentials</span></div>${certs.map(c => `<div class="profile-entry"><div class="entry-title">${esc(c.name||'')}</div><div class="entry-meta">${esc(c.issuer||'')} ${c.year?'· '+esc(c.year):''}</div></div>`).join('')}</div>` : ''}
        ${accomplishments.length > 0 ? `<div class="profile-section"><div class="profile-section-header"><span>🏆 Milestones</span></div>${accomplishments.map(a => `<div class="profile-entry"><div class="entry-title">${esc(a.title||'')}</div>${a.description?`<div class="entry-desc">${esc(a.description)}</div>`:''}</div>`).join('')}</div>` : ''}
        ${u.career_goals ? `<div class="profile-section"><div class="profile-section-header"><span>🎯 Career Vision</span></div><p style="line-height:1.5;color:var(--text-secondary);">${esc(u.career_goals)}</p></div>` : ''}
        <div class="profile-section"><div class="profile-section-header"><span>📄 Resume</span></div>
            ${u.has_resume ? (u.resume ? `<button class="btn-outline btn-sm" onclick="viewResume(${u.id})">📄 View Resume</button>` :
              u.resume_access === 'pending' ? `<button class="btn-outline btn-sm" disabled>⏳ Request Pending</button>` :
              u.resume_access === 'approved' ? `<button class="btn-outline btn-sm" onclick="viewResume(${u.id})">📄 View Resume</button>` :
              `<button class="btn-primary btn-sm" onclick="requestResume(${u.id}, this)">🔒 Request Resume Access</button>`) :
              '<p style="color:#999;">No resume uploaded</p>'}
        </div>
        <div class="profile-links" style="padding:1rem;">
            ${u.linkedin ? `<a href="${esc(u.linkedin)}" target="_blank">LinkedIn</a>` : ''}
            ${u.github ? `<a href="${esc(u.github)}" target="_blank">GitHub</a>` : ''}
        </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

async function requestResume(userId, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Requesting...'; }
    await fetch(`/api/resume/request/${userId}`, { method:'POST' });
    if (btn) { btn.innerHTML = '⏳ Request Sent'; }
    showToast('Resume access requested');
}

async function showUserConnections(userId) {
    const res = await fetch(`/api/users/${userId}/connections`);
    const conns = await res.json();
    let html = '<div style="padding:1rem;">';
    if (conns.length === 0) { html += '<p style="color:#999;text-align:center;">No connections yet</p>'; }
    else { html += conns.map(c => `<div class="person-card"><div class="person-avatar">${c.username[0].toUpperCase()}</div><div class="person-info"><div class="person-name">${esc(c.username)}</div><div class="person-detail">${esc(c.company||'')} ${c.role?'· '+esc(c.role):''}</div></div></div>`).join(''); }
    html += '</div>';
    showProfileSheet('👥 Connections', html);
}

async function showUserPosts(userId) {
    const res = await fetch(`/api/users/${userId}/posts`);
    const posts = await res.json();
    let html = '<div style="padding:0.5rem;">';
    if (posts.length === 0) { html += '<p style="color:#999;text-align:center;">No posts yet</p>'; }
    else { html += posts.map(p => `<div class="post-card" style="margin-bottom:0.5rem;"><span class="post-type ${p.type}" style="float:right;">${p.type}</span><h3 style="font-size:0.95rem;">${esc(p.title)}</h3><div class="post-body" style="font-size:0.85rem;">${esc(p.content).substring(0,150)}${p.content.length>150?'...':''}</div></div>`).join(''); }
    html += '</div>';
    showProfileSheet('📝 Posts', html);
}

async function showMyConnections() { showUserConnections(window._profileData?.id); }
async function showMyPosts() { showUserPosts(window._profileData?.id); }

async function viewResume(userId) {
    const res = await fetch(`/api/users/${userId}`);
    const u = await res.json();
    if (u.resume) {
        const w = window.open();
        w.document.write(`<iframe src="${u.resume}" style="width:100%;height:100%;border:none;"></iframe>`);
    } else {
        alert('No resume available');
    }
}

// ─── REFERRALS ───
async function loadReferralRequests() {
    const list = document.getElementById('referralList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/referral-requests');
    const reqs = await res.json();
    if (reqs.error) { list.innerHTML = ''; return; }
    if (reqs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔗</div><p>No open referral requests</p></div>';
        return;
    }
    list.innerHTML = reqs.map(r => `
        <div class="referral-card">
            <div class="ref-company">${esc(r.target_company)}</div>
            <div class="ref-role">${esc(r.target_role)}</div>
            ${r.description ? `<div class="ref-desc">${esc(r.description)}</div>` : ''}
            ${r.skills_required ? `<div class="ref-skills">${r.skills_required.split(',').map(s => `<span class="tag">${s.trim()}</span>`).join('')}</div>` : ''}
            <div class="ref-footer">
                <span>by ${esc(r.username)} ${r.seeker_company ? '· ' + esc(r.seeker_company) : ''}</span>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn-primary btn-sm btn-accent" onclick="acceptReferral(${r.id})">I can refer</button>
                    <button class="btn-outline btn-sm" onclick="openChat(${r.seeker_id}, '${esc(r.username)}')">Chat</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadMyReferrals() {
    const list = document.getElementById('myReferralList');
    if (!list) return;
    const res = await fetch('/api/my-referral-requests');
    const reqs = await res.json();
    if (reqs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No referral requests yet</p></div>';
        return;
    }
    list.innerHTML = reqs.map(r => `
        <div class="referral-card">
            <div class="ref-company">${esc(r.target_company)}</div>
            <div class="ref-role">${esc(r.target_role)}</div>
            <div class="ref-footer">
                <span class="ref-status ${r.status}">${r.status}</span>
                ${r.referrer_name ? `<span>Referrer: ${esc(r.referrer_name)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function openCreateReferral() { document.getElementById('referralModal').classList.add('open'); }

async function submitReferral() {
    const target_company = document.getElementById('refCompany').value.trim();
    const target_role = document.getElementById('refRole').value.trim();
    const skills_required = document.getElementById('refSkills').value.trim();
    const description = document.getElementById('refDesc').value.trim();
    if (!target_company || !target_role) { alert('Company and role required'); return; }
    await fetch('/api/referral-requests', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({target_company, target_role, skills_required, description}) });
    closeModal('referralModal');
    document.getElementById('refCompany').value = '';
    document.getElementById('refRole').value = '';
    document.getElementById('refSkills').value = '';
    document.getElementById('refDesc').value = '';
    document.querySelectorAll('.ref-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ref-section').forEach(s => s.classList.remove('active'));
    document.querySelector('.ref-tab[data-ref="my"]').classList.add('active');
    document.getElementById('refMy').classList.add('active');
    loadMyReferrals();
}

async function acceptReferral(reqId) {
    await fetch(`/api/referral-requests/${reqId}/accept`, { method:'POST' });
    loadReferralRequests();
}

// ─── MESSAGES ───
async function loadConversations() {
    const list = document.getElementById('conversationList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/conversations');
    const convos = await res.json();
    if (convos.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No conversations yet</p></div>';
        return;
    }
    list.innerHTML = convos.map(c => `
        <div class="convo-card" onclick="openChat(${c.id}, '${esc(c.username)}')">
            <div class="convo-avatar">${c.username[0].toUpperCase()}</div>
            <div class="convo-info">
                <div class="convo-name">${esc(c.username)} ${c.company ? '<span style="color:#999;font-weight:400;font-size:0.8rem;">· ' + esc(c.company) + '</span>' : ''}</div>
                <div class="convo-preview">${esc(c.last_message)}</div>
            </div>
            <div class="convo-meta">
                ${c.last_time ? `<div class="convo-time">${timeAgo(c.last_time)}</div>` : ''}
                ${c.unread > 0 ? `<div class="convo-unread">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

let currentReplyToId = null;
let currentReplyToName = '';
let currentChatUsername = '';

function openChat(userId, username) {
    currentChatUserId = userId;
    currentChatUsername = username;
    currentReplyToId = null;
    switchTabByName('messages');
    document.getElementById('messagesConvoView').style.display = 'none';
    const chatView = document.getElementById('messagesChatView');
    chatView.style.display = 'flex';
    const avatarLetter = (username || 'U')[0].toUpperCase();
    document.getElementById('chatUserAvatar').textContent = avatarLetter;
    document.getElementById('inlineChatTitle').innerHTML = `<span class="chat-title-name" onclick="viewUserProfile(${userId})">${username}</span>`;
    document.getElementById('replyPreview').style.display = 'none';
    loadChatMessages();
    setTimeout(() => {
        const input = document.getElementById('inlineChatInput');
        if (input) input.focus();
    }, 200);
}

function backToConversations() {
    showConvoView();
    currentChatUserId = null;
    currentGroupId = null;
    currentReplyToId = null;
    loadConversations();
}

function showConvoView() {
    const convoView = document.getElementById('messagesConvoView');
    const chatView = document.getElementById('messagesChatView');
    if (convoView) convoView.style.display = 'block';
    if (chatView) chatView.style.display = 'none';
}

function getMsgReactionSummary(reactions) {
    if (!reactions) return '';
    const entries = Object.entries(reactions).filter(([,v]) => v > 0);
    if (entries.length === 0) return '';
    return entries.map(([r, c]) => `${r}${c > 1 ? c : ''}`).join(' ');
}

async function loadChatMessages() {
    if (!currentChatUserId) return;
    const res = await fetch(`/api/messages/${currentChatUserId}`);
    const msgs = await res.json();
    const container = document.getElementById('inlineChatMessages');
    if (msgs.length === 0) { container.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Start the conversation</p>'; return; }
    container.innerHTML = msgs.map(m => {
        const isReceived = m.sender_id === currentChatUserId;
        const avatarLetter = (m.sender_name || 'U')[0].toUpperCase();
        const reactionStr = getMsgReactionSummary(m.reactions);
        const replyHtml = m.reply_to ? `<div class="msg-reply-ref" onclick="scrollToMsg(${m.reply_to.id})"><span class="reply-ref-name">${esc(m.reply_to.username)}</span> ${esc(m.reply_to.message)}</div>` : '';
        return `
        <div class="msg-row ${isReceived ? 'received' : 'sent'}" id="msg-${m.id}"
             ontouchstart="msgTouchStart(event, ${m.id}, '${esc(m.sender_name)}', '${esc(m.message).substring(0,60)}')"
             ontouchmove="msgTouchMove(event)" ontouchend="msgTouchEnd(event, ${m.id})">
            ${isReceived ? `<div class="msg-avatar">${avatarLetter}</div>` : ''}
            <div class="msg-bubble-wrap">
                ${replyHtml}
                <div class="msg-bubble ${isReceived ? 'received' : 'sent'}">
                    ${esc(m.message)}
                    <span class="time">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    ${m.starred ? '<span class="msg-star">⭐</span>' : ''}
                </div>
                ${reactionStr ? `<div class="msg-reactions">${reactionStr}</div>` : ''}
                <div class="msg-hover-actions">
                    <button onclick="reactToMsg(${m.id}, '❤️')" title="Love">❤️</button>
                    <button onclick="reactToMsg(${m.id}, '😂')" title="Laugh">😂</button>
                    <button onclick="reactToMsg(${m.id}, '👍')" title="Like">👍</button>
                    <button onclick="replyToMsg(${m.id}, '${esc(m.sender_name)}', '${esc(m.message).substring(0,60)}')" title="Reply">↩️</button>
                    <button onclick="toggleMsgMenu(${m.id})" title="More">⋯</button>
                </div>
                <div class="msg-menu" id="msgMenu-${m.id}" style="display:none;">
                    <button onclick="starMsg(${m.id})">⭐ Star</button>
                    <button onclick="replyToMsg(${m.id}, '${esc(m.sender_name)}', '${esc(m.message).substring(0,60)}')">↩️ Reply</button>
                    <button onclick="reportMessage(${m.id})">⚠️ Report</button>
                </div>
            </div>
            ${!isReceived ? `<div class="msg-avatar">${avatarLetter}</div>` : ''}
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function scrollToMsg(msgId) {
    const el = document.getElementById('msg-' + msgId);
    if (el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('highlight-msg'); setTimeout(() => el.classList.remove('highlight-msg'), 1500); }
}

function replyToMsg(msgId, senderName, preview) {
    currentReplyToId = msgId;
    document.getElementById('replyPreviewName').textContent = senderName;
    document.getElementById('replyPreviewText').textContent = preview;
    document.getElementById('replyPreview').style.display = 'flex';
    document.getElementById('inlineChatInput').focus();
    closeMsgMenus();
}

function cancelReply() {
    currentReplyToId = null;
    document.getElementById('replyPreview').style.display = 'none';
}

async function reactToMsg(msgId, reaction) {
    await fetch(`/api/messages/${msgId}/react`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reaction}) });
    loadChatMessages();
}

async function starMsg(msgId) {
    await fetch(`/api/messages/${msgId}/star`, { method:'POST' });
    closeMsgMenus();
    loadChatMessages();
}

function toggleMsgMenu(msgId) {
    closeMsgMenus();
    const menu = document.getElementById('msgMenu-' + msgId);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}
function closeMsgMenus() { document.querySelectorAll('.msg-menu').forEach(m => m.style.display = 'none'); }

function reportMessage(msgId) {
    closeMsgMenus();
    openReportModal('message', msgId);
}

// Mobile swipe-to-reply
let msgTouchStartX = 0;
let msgSwipeId = null;
function msgTouchStart(e, msgId, name, preview) {
    msgTouchStartX = e.touches[0].clientX;
    msgSwipeId = { id: msgId, name, preview };
}
function msgTouchMove(e) {}
function msgTouchEnd(e, msgId) {
    if (!msgSwipeId) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - msgTouchStartX;
    if (diff > 60) { replyToMsg(msgSwipeId.id, msgSwipeId.name, msgSwipeId.preview); }
    msgSwipeId = null;
}

async function sendChatMessage() {
    const input = document.getElementById('inlineChatInput');
    const msg = input.value.trim();
    if (!msg && !chatFileBase64) return;

    // Group message
    if (currentGroupId) {
        const body = { message: msg };
        if (chatFileBase64) { body.file_url = chatFileBase64; body.file_name = chatFileName; }
        await fetch(`/api/groups/${currentGroupId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        input.value = '';
        clearChatFile();
        loadGroupMessages();
        return;
    }

    // DM
    if (!currentChatUserId) return;
    const body = { receiver_id: currentChatUserId, message: msg };
    if (currentReplyToId) body.reply_to_id = currentReplyToId;
    if (chatFileBase64) { body.file_url = chatFileBase64; body.file_name = chatFileName; }
    await fetch('/api/messages/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    input.value = '';
    cancelReply();
    clearChatFile();
    loadChatMessages();
}

function startCall() { alert('📞 Voice call feature coming soon! For now, share your phone number in chat.'); }
function startVideoCall() { alert('📹 Video call feature coming soon!'); }

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff/60) + 'm';
    if (diff < 86400) return Math.floor(diff/3600) + 'h';
    return Math.floor(diff/86400) + 'd';
}

// ─── COMPANY INSIGHTS ───
async function loadReviews() {
    const list = document.getElementById('reviewsList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/company-reviews');
    const reviews = await res.json();
    if (reviews.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏢</div><p>No company reviews yet. Share your experience anonymously!</p></div>';
        return;
    }
    list.innerHTML = reviews.map(r => `
        <div class="review-card">
            <h3>${esc(r.company)}</h3>
            <div class="review-ratings">
                ${r.salary_range ? `<span class="rating-pill">💰 ${esc(r.salary_range)}</span>` : ''}
                ${r.work_life_rating ? `<span class="rating-pill">⚖️ WLB: ${r.work_life_rating}/5</span>` : ''}
                ${r.manager_rating ? `<span class="rating-pill">👔 Mgr: ${r.manager_rating}/5</span>` : ''}
                ${r.work_pressure ? `<span class="rating-pill">🔥 Pressure: ${r.work_pressure}</span>` : ''}
            </div>
            ${r.review ? `<p style="color:#666;line-height:1.5;">${esc(r.review)}</p>` : ''}
            <div style="font-size:0.75rem;color:#999;margin-top:0.5rem;">Anonymous · ${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

function openAddReview() { document.getElementById('reviewModal').classList.add('open'); }

async function submitReview() {
    const company = document.getElementById('reviewCompany').value.trim();
    if (!company) { alert('Company name required'); return; }
    const data = {
        company,
        salary_range: document.getElementById('reviewSalary').value.trim(),
        work_life_rating: parseInt(document.getElementById('reviewWLB').value),
        manager_rating: parseInt(document.getElementById('reviewMgr').value),
        work_pressure: document.getElementById('reviewPressure').value,
        review: document.getElementById('reviewText').value.trim(),
        anonymous: true
    };
    await fetch('/api/company-reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    closeModal('reviewModal');
    document.getElementById('reviewCompany').value = '';
    document.getElementById('reviewSalary').value = '';
    document.getElementById('reviewText').value = '';
    loadReviews();
}

// ─── NOTIFICATIONS (CLICKABLE) ───
async function loadNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/notifications');
    const notifs = await res.json();
    if (notifs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><p>No notifications yet</p></div>';
        return;
    }
    list.innerHTML = notifs.map(n => {
        let clickAction = '';
        let clickClass = '';
        if (n.type === 'message') {
            clickAction = `onclick="navigateToChat(${n.from_user_id}, '${esc(n.username)}')"`;
            clickClass = 'clickable-notif';
        } else if (n.type === 'story_reaction' || n.type === 'story_reply') {
            clickAction = `onclick="navigateToChat(${n.from_user_id}, '${esc(n.username)}')"`;
            clickClass = 'clickable-notif';
        } else if (n.type === 'mention') {
            if (n.related_id) {
                clickAction = `onclick="navigateToPost(${n.related_id})"`;
            } else {
                clickAction = `onclick="navigateToChat(${n.from_user_id}, '${esc(n.username)}')"`;
            }
            clickClass = 'clickable-notif';
        } else if (n.type === 'new_post' || n.type === 'comment') {
            if (n.related_id) {
                clickAction = `onclick="navigateToPost(${n.related_id})"`;
                clickClass = 'clickable-notif';
            }
        } else if (n.type === 'connection_accepted') {
            clickAction = `onclick="viewUserProfile(${n.from_user_id})"`;
            clickClass = 'clickable-notif';
        }

        return `
        <div class="notif-item ${n.read ? '' : 'unread'} ${clickClass}" ${n.type !== 'connection_request' ? clickAction : ''} style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <div style="flex:1;min-width:0;">
                <strong>${esc(n.username || 'System')}</strong> ${esc(n.message)}
                <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
            </div>
            ${n.type === 'connection_request' && n.conn_status === 'pending' ? `
                <div style="display:flex;gap:0.5rem;flex-shrink:0;">
                    <button class="btn-primary btn-sm btn-accent" onclick="event.stopPropagation(); acceptFromNotif(${n.from_user_id})">Accept</button>
                    <button class="btn-outline btn-sm" onclick="event.stopPropagation(); rejectFromNotif(${n.from_user_id})">Decline</button>
                </div>
            ` : n.type === 'connection_request' && n.conn_status === 'accepted' ? `<span style="color:#28a745;font-size:0.85rem;flex-shrink:0;">✓ Accepted</span>` : ''}
        </div>`;
    }).join('');
    document.getElementById('notifBadge').style.display = 'none';
}

function navigateToChat(userId, username) {
    openChat(userId, username);
}

async function navigateToPost(postId) {
    // Switch to feed tab and scroll to the post
    switchTabByName('feed');
    await loadFeed();
    setTimeout(() => {
        const postEl = document.getElementById('post-' + postId);
        if (postEl) {
            postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            postEl.classList.add('highlight-post');
            setTimeout(() => postEl.classList.remove('highlight-post'), 2000);
        }
    }, 300);
}

async function acceptFromNotif(senderId) {
    await fetch('/api/connections/respond', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sender_id:senderId, action:'accept'}) });
    loadNotifications();
}

async function rejectFromNotif(senderId) {
    await fetch('/api/connections/respond', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sender_id:senderId, action:'reject'}) });
    loadNotifications();
}

async function checkNotifications() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        const data = await res.json();
        const badge = document.getElementById('notifBadge');
        if (!badge) return;
        if (data.count > 0) { badge.textContent = data.count; badge.style.display = 'inline'; }
        else badge.style.display = 'none';
    } catch {}
}

// ─── PROFILE ───
async function loadProfile() {
    const container = document.getElementById('profileContent');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Loading...</p>';
    const res = await fetch('/api/profile');
    const p = await res.json();
    if (p.error) { container.innerHTML = '<p style="color:#dc3545;">Failed to load profile</p>'; return; }

    const workHistory = p.work_history || [];
    const education = p.education || [];
    const projects = p.projects || [];
    const certs = p.certifications || [];
    const accomplishments = p.accomplishments || [];
    const personalInfo = p.personal_info || {};
    const internships = p.internships || [];
    const isStudent = p.account_type === 'student';

    // Calculate profile completion
    const sections = isStudent
        ? [p.headline, p.bio, p.skills, p.college, p.degree_pursuing, p.graduation_year, p.cgpa,
           education.length > 0, projects.length > 0, internships.length > 0, certs.length > 0,
           p.career_goals, p.linkedin || p.github]
        : [p.headline, p.bio, p.company, p.role, p.skills, p.location,
           workHistory.length > 0, education.length > 0, projects.length > 0,
           certs.length > 0, accomplishments.length > 0, p.career_goals, p.linkedin || p.github, p.resume];
    const filled = sections.filter(Boolean).length;
    const total = sections.length;
    const pct = Math.round((filled / total) * 100);
    const pctColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? '#f59e0b' : 'var(--danger)';

    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-top">
                <div class="profile-avatar">${(p.username || 'U')[0].toUpperCase()}</div>
                <div class="profile-info">
                    <h2>${esc(p.username)}</h2>
                    ${p.headline ? `<div style="font-size:1rem;color:var(--text);margin-bottom:0.15rem;">${esc(p.headline)}</div>` : ''}
                    ${isStudent
                        ? `<div class="company-role">🎓 ${esc(p.degree_pursuing || 'Student')} ${p.college ? 'at ' + esc(p.college) : ''}</div>`
                        : `<div class="company-role">${esc(p.company || '')} ${p.role ? '· ' + esc(p.role) : ''}</div>`}
                    ${p.location ? `<div style="color:#999;font-size:0.85rem;">📍 ${esc(p.location)}</div>` : ''}
                    ${p.tagline ? `<div style="color:var(--accent);font-size:0.85rem;font-style:italic;margin-top:0.25rem;">"${esc(p.tagline)}"</div>` : ''}
                    <div style="font-size:0.75rem;color:#999;margin-top:0.25rem;">${isStudent ? '🎓 Student Account' : '💼 Professional Account'}</div>
                </div>
            </div>
            <div class="profile-stats">
                <div class="pstat" style="cursor:pointer;" onclick="showMyConnections()"><div class="num">${p.connections_count || 0}</div><div class="lbl">Connections</div></div>
                <div class="pstat" style="cursor:pointer;" onclick="showMyPosts()"><div class="num">${p.posts_count || 0}</div><div class="lbl">Posts</div></div>
                <div class="pstat"><div class="num">${p.experience || 0}</div><div class="lbl">${isStudent ? 'Sem' : 'Years Exp'}</div></div>
            </div>
        </div>

        <!-- Profile Completion -->
        <div class="profile-section" style="padding:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <span style="font-weight:700;">Profile Strength</span>
                <span style="font-weight:700;color:${pctColor};">${pct}%</span>
            </div>
            <div style="background:var(--border);border-radius:1rem;height:8px;overflow:hidden;">
                <div style="background:${pctColor};height:100%;width:${pct}%;border-radius:1rem;transition:width 0.5s;"></div>
            </div>
            ${pct < 100 ? `<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.4rem;">Complete your profile to stand out! ${total - filled} section${total - filled > 1 ? 's' : ''} remaining.</p>` : `<p style="font-size:0.8rem;color:var(--success);margin-top:0.4rem;">🎉 Profile complete! You're all set.</p>`}
        </div>

        <!-- About -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🧑 About</span><button class="section-edit-btn" onclick="openProfileSection('about')">✏️</button></div>
            ${p.bio ? `<p style="line-height:1.5;color:var(--text-secondary);">${esc(p.bio)}</p>` : '<p style="color:#999;">Add a summary about yourself</p>'}
        </div>

        <!-- Expertise -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🛠️ Expertise</span><button class="section-edit-btn" onclick="openProfileSection('skills')">✏️</button></div>
            ${p.skills ? `<div class="profile-skills">${p.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('')}</div>` : '<p style="color:#999;">Add your key skills</p>'}
        </div>

        ${isStudent ? `
        <!-- Student: Academic Info -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🏫 Academics</span><button class="section-edit-btn" onclick="openProfileSection('academics')">✏️</button></div>
            ${p.college ? `<div class="profile-entry"><div class="entry-title">${esc(p.college)}</div><div class="entry-meta">${esc(p.degree_pursuing || '')} · Graduating ${esc(p.graduation_year || '')}</div>${p.cgpa ? `<div class="entry-desc">CGPA: ${esc(p.cgpa)}</div>` : ''}</div>` : '<p style="color:#999;">Add your academic details</p>'}
        </div>

        <!-- Student: Internships -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🏢 Internships</span><button class="section-edit-btn" onclick="openProfileSection('internships')">+ Add</button></div>
            ${internships.length > 0 ? internships.map(w => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(w.title || '')} at ${esc(w.company || '')}</div>
                    <div class="entry-meta">${esc(w.period || '')}</div>
                    ${w.description ? `<div class="entry-desc">${esc(w.description)}</div>` : ''}
                </div>
            `).join('') : '<p style="color:#999;">Add internship experience</p>'}
        </div>
        ` : `
        <!-- Professional: Work Journey -->
        <div class="profile-section">
            <div class="profile-section-header"><span>💼 Work Journey</span><button class="section-edit-btn" onclick="openProfileSection('work')">+ Add</button></div>
            ${workHistory.length > 0 ? workHistory.map(w => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(w.title || '')} ${w.company ? 'at ' + esc(w.company) : ''}</div>
                    <div class="entry-meta">${esc(w.period || '')} ${w.location ? '· ' + esc(w.location) : ''}</div>
                    ${w.description ? `<div class="entry-desc">${esc(w.description)}</div>` : ''}
                </div>
            `).join('') : '<p style="color:#999;">Share your work experience</p>'}
        </div>
        `}

        <!-- Learning Path -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🎓 Learning Path</span><button class="section-edit-btn" onclick="openProfileSection('education')">+ Add</button></div>
            ${education.length > 0 ? education.map(e => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(e.degree || '')} ${e.field ? '— ' + esc(e.field) : ''}</div>
                    <div class="entry-meta">${esc(e.institution || '')} ${e.year ? '· ' + esc(e.year) : ''}</div>
                </div>
            `).join('') : '<p style="color:#999;">Add your education background</p>'}
        </div>

        <!-- Builds & Projects -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🚀 Builds & Projects</span><button class="section-edit-btn" onclick="openProfileSection('projects')">+ Add</button></div>
            ${projects.length > 0 ? projects.map(pr => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(pr.name || '')}</div>
                    ${pr.description ? `<div class="entry-desc">${esc(pr.description)}</div>` : ''}
                    ${pr.link ? `<a href="${esc(pr.link)}" target="_blank" style="font-size:0.8rem;color:var(--accent);">View →</a>` : ''}
                </div>
            `).join('') : '<p style="color:#999;">Showcase your projects</p>'}
        </div>

        <!-- Credentials -->
        <div class="profile-section">
            <div class="profile-section-header"><span>📜 Credentials</span><button class="section-edit-btn" onclick="openProfileSection('certs')">+ Add</button></div>
            ${certs.length > 0 ? certs.map(c => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(c.name || '')}</div>
                    <div class="entry-meta">${esc(c.issuer || '')} ${c.year ? '· ' + esc(c.year) : ''}</div>
                </div>
            `).join('') : '<p style="color:#999;">Add certifications & licenses</p>'}
        </div>

        <!-- Milestones -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🏆 Milestones</span><button class="section-edit-btn" onclick="openProfileSection('milestones')">+ Add</button></div>
            ${accomplishments.length > 0 ? accomplishments.map(a => `
                <div class="profile-entry">
                    <div class="entry-title">${esc(a.title || '')}</div>
                    ${a.description ? `<div class="entry-desc">${esc(a.description)}</div>` : ''}
                </div>
            `).join('') : '<p style="color:#999;">Highlight your achievements</p>'}
        </div>

        <!-- Career Vision -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🎯 Career Vision</span><button class="section-edit-btn" onclick="openProfileSection('career')">✏️</button></div>
            ${p.career_goals ? `<p style="line-height:1.5;color:var(--text-secondary);">${esc(p.career_goals)}</p>` : '<p style="color:#999;">What are you working towards?</p>'}
        </div>

        <!-- Links & Socials -->
        <div class="profile-section">
            <div class="profile-section-header"><span>🔗 Links & Socials</span><button class="section-edit-btn" onclick="openProfileSection('links')">✏️</button></div>
            <div class="profile-links">
                ${p.linkedin ? `<a href="${esc(p.linkedin)}" target="_blank">LinkedIn</a>` : ''}
                ${p.github ? `<a href="${esc(p.github)}" target="_blank">GitHub</a>` : ''}
                ${!p.linkedin && !p.github ? '<p style="color:#999;">Add your social links</p>' : ''}
            </div>
        </div>

        <!-- Resume -->
        <div class="profile-section">
            <div class="profile-section-header"><span>📄 Resume</span></div>
            ${p.resume ? `<div style="display:flex;gap:0.5rem;align-items:center;">
                <span style="color:var(--success);font-size:0.9rem;">✓ Uploaded</span>
                <button class="btn-outline btn-sm" onclick="viewMyResume()">View</button>
                <button class="btn-outline btn-sm" onclick="document.getElementById('resumeInput').click()">Replace</button>
            </div>` : `<button class="btn-outline btn-sm" onclick="document.getElementById('resumeInput').click()">Upload Resume (PDF)</button>`}
            <input type="file" id="resumeInput" accept=".pdf" style="display:none;" onchange="handleResumeUpload(event)" />
        </div>

        <!-- Settings -->
        <div class="profile-section">
            <div class="profile-section-header"><span>⚙️ Settings</span></div>
            <div class="referral-toggle" style="margin:0;">
                <label class="toggle-switch"><input type="checkbox" id="refToggle" ${p.available_for_referral ? 'checked' : ''} onchange="toggleReferralAvailability()"><span class="toggle-slider"></span></label>
                <span style="font-weight:600;">Available for referrals</span>
            </div>
            <div class="referral-toggle" style="margin:0.5rem 0 0;">
                <label class="toggle-switch"><input type="checkbox" id="privacyToggle" ${p.is_private ? 'checked' : ''} onchange="togglePrivacy()"><span class="toggle-slider"></span></label>
                <div style="flex:1;min-width:0;"><span style="font-weight:600;">Private Profile</span><div style="font-size:0.8rem;color:#999;">Only connections see full details</div></div>
            </div>
        </div>
    `;
    window._profileData = p;
}

function openEditProfile() { openProfileSection('about'); }

async function saveProfile() {
    const p = window._profileData || {};
    const data = {
        username: document.getElementById('editName')?.value.trim() || p.username,
        company: document.getElementById('editCompany')?.value.trim() || p.company,
        role: document.getElementById('editRole')?.value.trim() || p.role,
        experience: parseInt(document.getElementById('editExp')?.value) || p.experience || 0,
        bio: document.getElementById('editBio')?.value.trim() || p.bio,
        skills: document.getElementById('editSkills')?.value.trim() || p.skills,
        linkedin: document.getElementById('editLinkedin')?.value.trim() || p.linkedin,
        github: document.getElementById('editGithub')?.value.trim() || p.github,
        headline: document.getElementById('editHeadline')?.value.trim() || p.headline,
        tagline: document.getElementById('editTagline')?.value.trim() || p.tagline,
        location: document.getElementById('editLocation')?.value.trim() || p.location,
        career_goals: document.getElementById('editCareer')?.value.trim() || p.career_goals,
        available_for_referral: document.getElementById('refToggle')?.checked || false,
        is_private: document.getElementById('privacyToggle')?.checked || false,
        account_type: p.account_type || 'professional',
        college: p.college, degree_pursuing: p.degree_pursuing,
        graduation_year: p.graduation_year, cgpa: p.cgpa,
        internships: p.internships || [],
        work_history: p.work_history || [],
        education: p.education || [],
        projects: p.projects || [],
        certifications: p.certifications || [],
        accomplishments: p.accomplishments || [],
        personal_info: p.personal_info || {}
    };
    try {
        const res = await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) { showToast('Profile updated!'); loadProfile(); }
        else { const r = await res.json(); showToast('Error: ' + (r.error || 'Failed')); }
    } catch (e) { showToast('Failed: ' + e.message); }
}

function openProfileSection(section) {
    const p = window._profileData || {};
    let title = '', body = '';
    switch(section) {
        case 'about':
            title = '🧑 Edit Profile';
            body = `
                <div class="form-group"><label>Full Name</label><input type="text" id="editName" value="${esc(p.username || '')}" /></div>
                <div class="form-group"><label>Headline</label><input type="text" id="editHeadline" value="${esc(p.headline || '')}" placeholder="e.g. Senior Developer | Open Source Enthusiast" /></div>
                <div class="form-group"><label>Tagline</label><input type="text" id="editTagline" value="${esc(p.tagline || '')}" placeholder="A short motto or quote" /></div>
                <div class="form-group"><label>Company</label><input type="text" id="editCompany" value="${esc(p.company || '')}" /></div>
                <div class="form-group"><label>Role</label><input type="text" id="editRole" value="${esc(p.role || '')}" /></div>
                <div class="form-group"><label>Location</label><input type="text" id="editLocation" value="${esc(p.location || '')}" placeholder="City, Country" /></div>
                <div class="form-group"><label>Experience (years)</label><input type="number" id="editExp" value="${p.experience || 0}" /></div>
                <div class="form-group"><label>About Me</label><textarea id="editBio" rows="3">${esc(p.bio || '')}</textarea></div>
                <button class="btn-primary" onclick="saveProfile(); closeProfileSheet();">Save</button>`;
            break;
        case 'skills':
            title = '🛠️ Expertise';
            body = `
                <div class="form-group"><label>Skills (comma separated)</label><input type="text" id="editSkills" value="${esc(p.skills || '')}" placeholder="React, Python, Leadership..." /></div>
                <button class="btn-primary" onclick="saveProfile(); closeProfileSheet();">Save</button>`;
            break;
        case 'work':
            title = '💼 Add Work Experience';
            body = `
                <div class="form-group"><label>Job Title</label><input type="text" id="workTitle" /></div>
                <div class="form-group"><label>Company</label><input type="text" id="workCompany" /></div>
                <div class="form-group"><label>Period</label><input type="text" id="workPeriod" placeholder="e.g. Jan 2022 - Present" /></div>
                <div class="form-group"><label>Location</label><input type="text" id="workLocation" /></div>
                <div class="form-group"><label>Description</label><textarea id="workDesc" rows="2"></textarea></div>
                <button class="btn-primary" onclick="addProfileEntry('work_history', {title:gv('workTitle'),company:gv('workCompany'),period:gv('workPeriod'),location:gv('workLocation'),description:gv('workDesc')})">Add</button>`;
            break;
        case 'education':
            title = '🎓 Add Education';
            body = `
                <div class="form-group"><label>Degree</label><input type="text" id="eduDegree" placeholder="e.g. B.Tech, MBA" /></div>
                <div class="form-group"><label>Field of Study</label><input type="text" id="eduField" /></div>
                <div class="form-group"><label>Institution</label><input type="text" id="eduInst" /></div>
                <div class="form-group"><label>Year</label><input type="text" id="eduYear" placeholder="e.g. 2020" /></div>
                <button class="btn-primary" onclick="addProfileEntry('education', {degree:gv('eduDegree'),field:gv('eduField'),institution:gv('eduInst'),year:gv('eduYear')})">Add</button>`;
            break;
        case 'projects':
            title = '🚀 Add Project';
            body = `
                <div class="form-group"><label>Project Name</label><input type="text" id="projName" /></div>
                <div class="form-group"><label>Description</label><textarea id="projDesc" rows="2"></textarea></div>
                <div class="form-group"><label>Link (optional)</label><input type="text" id="projLink" placeholder="https://..." /></div>
                <button class="btn-primary" onclick="addProfileEntry('projects', {name:gv('projName'),description:gv('projDesc'),link:gv('projLink')})">Add</button>`;
            break;
        case 'certs':
            title = '📜 Add Credential';
            body = `
                <div class="form-group"><label>Certification Name</label><input type="text" id="certName" /></div>
                <div class="form-group"><label>Issuing Organization</label><input type="text" id="certIssuer" /></div>
                <div class="form-group"><label>Year</label><input type="text" id="certYear" /></div>
                <button class="btn-primary" onclick="addProfileEntry('certifications', {name:gv('certName'),issuer:gv('certIssuer'),year:gv('certYear')})">Add</button>`;
            break;
        case 'milestones':
            title = '🏆 Add Milestone';
            body = `
                <div class="form-group"><label>Title</label><input type="text" id="mileTitle" /></div>
                <div class="form-group"><label>Description</label><textarea id="mileDesc" rows="2"></textarea></div>
                <button class="btn-primary" onclick="addProfileEntry('accomplishments', {title:gv('mileTitle'),description:gv('mileDesc')})">Add</button>`;
            break;
        case 'career':
            title = '🎯 Career Vision';
            body = `
                <div class="form-group"><label>What are you working towards?</label><textarea id="editCareer" rows="3">${esc(p.career_goals || '')}</textarea></div>
                <button class="btn-primary" onclick="saveProfile(); closeProfileSheet();">Save</button>`;
            break;
        case 'links':
            title = '🔗 Links & Socials';
            body = `
                <div class="form-group"><label>LinkedIn URL</label><input type="text" id="editLinkedin" value="${esc(p.linkedin || '')}" /></div>
                <div class="form-group"><label>GitHub URL</label><input type="text" id="editGithub" value="${esc(p.github || '')}" /></div>
                <button class="btn-primary" onclick="saveProfile(); closeProfileSheet();">Save</button>`;
            break;
        case 'academics':
            title = '🏫 Academics';
            body = `
                <div class="form-group"><label>College / University</label><input type="text" id="editCollege" value="${esc(p.college || '')}" /></div>
                <div class="form-group"><label>Degree Pursuing</label><input type="text" id="editDegree" value="${esc(p.degree_pursuing || '')}" /></div>
                <div class="form-group"><label>Graduation Year</label><input type="text" id="editGradYear" value="${esc(p.graduation_year || '')}" /></div>
                <div class="form-group"><label>CGPA / Percentage</label><input type="text" id="editCgpa" value="${esc(p.cgpa || '')}" /></div>
                <button class="btn-primary" onclick="saveAcademics()">Save</button>`;
            break;
        case 'internships':
            title = '🏢 Add Internship';
            body = `
                <div class="form-group"><label>Role / Title</label><input type="text" id="internTitle" /></div>
                <div class="form-group"><label>Company</label><input type="text" id="internCompany" /></div>
                <div class="form-group"><label>Period</label><input type="text" id="internPeriod" placeholder="e.g. May 2025 - Jul 2025" /></div>
                <div class="form-group"><label>What you did</label><textarea id="internDesc" rows="2"></textarea></div>
                <button class="btn-primary" onclick="addProfileEntry('internships', {title:gv('internTitle'),company:gv('internCompany'),period:gv('internPeriod'),description:gv('internDesc')})">Add</button>`;
            break;
    }
    showProfileSheet(title, body);
}

function gv(id) { return document.getElementById(id)?.value.trim() || ''; }

function showProfileSheet(title, body) {
    let sheet = document.getElementById('profileEditSheet');
    if (!sheet) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="profileEditSheet" class="bottom-sheet-overlay" onclick="if(event.target===this)closeProfileSheet()">
                <div class="bottom-sheet" style="max-width:500px;">
                    <div class="bottom-sheet-handle" onclick="closeProfileSheet()"><div class="handle-bar"></div></div>
                    <div class="bottom-sheet-header"><h3 id="profileSheetTitle"></h3><button class="close-btn" onclick="closeProfileSheet()">&times;</button></div>
                    <div class="bottom-sheet-body" id="profileSheetBody" style="padding:1rem;"></div>
                </div>
            </div>`);
        sheet = document.getElementById('profileEditSheet');
    }
    document.getElementById('profileSheetTitle').textContent = title;
    document.getElementById('profileSheetBody').innerHTML = body;
    sheet.classList.add('open');
}

function closeProfileSheet() {
    const sheet = document.getElementById('profileEditSheet');
    if (sheet) sheet.classList.remove('open');
}

async function addProfileEntry(field, entry) {
    const p = window._profileData || {};
    const arr = p[field] || [];
    arr.push(entry);
    p[field] = arr;
    window._profileData = p;
    const data = {...p};
    for (const f of ['work_history','education','projects','certifications','accomplishments','personal_info','internships']) {
        if (data[f] && typeof data[f] === 'object') data[f] = JSON.stringify(data[f]);
    }
    data.available_for_referral = document.getElementById('refToggle')?.checked || false;
    data.is_private = document.getElementById('privacyToggle')?.checked || false;
    await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    closeProfileSheet();
    showToast('Added!');
    loadProfile();
}

async function saveAcademics() {
    const p = window._profileData || {};
    p.college = document.getElementById('editCollege')?.value.trim() || p.college;
    p.degree_pursuing = document.getElementById('editDegree')?.value.trim() || p.degree_pursuing;
    p.graduation_year = document.getElementById('editGradYear')?.value.trim() || p.graduation_year;
    p.cgpa = document.getElementById('editCgpa')?.value.trim() || p.cgpa;
    window._profileData = p;
    await saveProfile();
    closeProfileSheet();
}

async function toggleReferralAvailability() {
    const checked = document.getElementById('refToggle').checked;
    const priv = document.getElementById('privacyToggle')?.checked || false;
    const res = await fetch('/api/profile');
    const p = await res.json();
    p.available_for_referral = checked;
    p.is_private = priv;
    await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
}

async function togglePrivacy() {
    const priv = document.getElementById('privacyToggle').checked;
    const ref = document.getElementById('refToggle')?.checked || false;
    const res = await fetch('/api/profile');
    const p = await res.json();
    p.is_private = priv;
    p.available_for_referral = ref;
    await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
}

async function handleResumeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Resume must be under 5MB'); return; }
    if (file.type !== 'application/pdf') { alert('Only PDF files allowed'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const res = await fetch('/api/profile/resume', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ resume: e.target.result })
            });
            if (res.ok) { alert('Resume uploaded!'); loadProfile(); }
            else alert('Failed to upload resume');
        } catch (err) { alert('Upload failed: ' + err.message); }
    };
    reader.readAsDataURL(file);
}

function viewMyResume() {
    fetch('/api/profile').then(r => r.json()).then(p => {
        if (p.resume) {
            const w = window.open();
            w.document.write(`<iframe src="${p.resume}" style="width:100%;height:100%;border:none;"></iframe>`);
        } else alert('No resume uploaded');
    });
}

// ─── SEARCH ───
async function handleSearch() {
    const q = document.getElementById('searchInput').value.trim();
    const results = document.getElementById('searchResults');
    if (q.length < 2) { results.innerHTML = ''; return; }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    let html = '';
    if (data.users.length > 0) {
        html += '<div style="padding:0.5rem;font-weight:700;color:#999;font-size:0.8rem;">PEOPLE</div>';
        html += data.users.map(u => `
            <div class="search-result-item" onclick="closeSearch(); viewUserProfile(${u.id})">
                <strong>👤 ${esc(u.username)}</strong>
                <span style="color:#666;font-size:0.85rem;"> · ${esc(u.company || '')} · ${esc(u.role || '')}</span>
                ${u.available_for_referral ? '<span style="color:#28a745;font-size:0.75rem;"> ✓ Can refer</span>' : ''}
            </div>
        `).join('');
    }
    if (data.posts.length > 0) {
        html += '<div style="padding:0.5rem;font-weight:700;color:#999;font-size:0.8rem;">POSTS</div>';
        html += data.posts.map(p => `
            <div class="search-result-item" onclick="closeSearch(); switchTabByName('feed')">
                <strong>📝 ${esc(p.title)}</strong>
                <span style="color:#666;font-size:0.85rem;"> by ${esc(p.username)}</span>
            </div>
        `).join('');
    }
    if (!html) html = '<div class="search-result-item">No results found</div>';
    results.innerHTML = html;
}

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

// ─── STORIES ───
async function loadStories() {
    const list = document.getElementById('storiesList');
    if (!list) return;
    try {
        const res = await fetch('/api/stories');
        const groups = await res.json();
        if (groups.length === 0) { list.innerHTML = ''; return; }
        list.innerHTML = groups.map(g => `
            <div class="story-item" onclick="viewStories(${g.user_id})">
                <div class="story-avatar has-story">${(g.username || 'U')[0].toUpperCase()}</div>
                <span class="story-name">${g.username.length > 8 ? g.username.substring(0,8) + '..' : g.username}</span>
            </div>
        `).join('');
    } catch {}
}

function openCreateStory() { document.getElementById('storyModal').classList.add('open'); }

let selectedStoryColor = '#7c3aed';
let storyMediaBase64 = null;

function pickStoryColor(btn) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
    btn.classList.add('selected');
    selectedStoryColor = btn.dataset.color;
}

function previewStoryMedia(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        storyMediaBase64 = e.target.result;
        const preview = document.getElementById('storyMediaPreview');
        const img = document.getElementById('storyMediaImg');
        if (file.type.startsWith('video/')) {
            preview.innerHTML = `<video src="${storyMediaBase64}" style="width:100%;max-height:200px;border-radius:var(--radius);" controls></video><button onclick="removeStoryMedia()" style="position:absolute;top:0.25rem;right:0.25rem;background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:0.8rem;">✕</button>`;
        } else {
            img.src = storyMediaBase64;
            preview.innerHTML = '';
            preview.appendChild(img);
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.onclick = removeStoryMedia;
            closeBtn.style.cssText = 'position:absolute;top:0.25rem;right:0.25rem;background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:0.8rem;';
            preview.appendChild(closeBtn);
        }
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeStoryMedia() {
    storyMediaBase64 = null;
    document.getElementById('storyMediaPreview').style.display = 'none';
    document.getElementById('storyMediaInput').value = '';
}

async function submitStory() {
    const content = document.getElementById('storyContent').value.trim();
    if (!content && !storyMediaBase64) { alert('Add some text or media for your story'); return; }
    const payload = { content, bg_color: selectedStoryColor };
    if (storyMediaBase64) payload.media_url = storyMediaBase64;
    await fetch('/api/stories', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    closeModal('storyModal');
    document.getElementById('storyContent').value = '';
    removeStoryMedia();
    loadStories();
}

let storyViewData = [];
let storyViewIndex = 0;
async function viewStories(userId) {
    const res = await fetch('/api/stories');
    const groups = await res.json();
    const group = groups.find(g => g.user_id === userId);
    if (!group || !group.stories.length) return;
    storyViewData = group.stories;
    storyViewIndex = 0;
    showStorySlide();
    document.getElementById('storyViewModal').classList.add('open');
}

function showStorySlide() {
    const s = storyViewData[storyViewIndex];
    if (!s) return;
    document.getElementById('storyProgress').innerHTML = storyViewData.map((_, i) =>
        `<div class="story-prog-bar ${i <= storyViewIndex ? 'active' : ''}"></div>`
    ).join('');
    document.getElementById('storyViewerHeader').innerHTML = `<span style="font-weight:700;">${esc(s.username)}</span> <span style="color:rgba(255,255,255,0.7);font-size:0.8rem;">${timeAgo(s.created_at)}</span>`;
    document.getElementById('storyViewer').style.background = s.media_url ? '#000' : (s.bg_color || '#7c3aed');
    const deleteBtn = document.getElementById('storyDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = s.is_own ? 'block' : 'none';
    // Reactions display + view count
    const reactionsDisplay = document.getElementById('storyReactionsDisplay');
    let reactHtml = '';
    if (s.reactions && Object.keys(s.reactions).length > 0) {
        reactHtml = Object.entries(s.reactions).map(([r, c]) => `${r} ${c}`).join('  ');
    }
    if (s.is_own) {
        reactHtml += `  <span style="cursor:pointer;" onclick="showStoryInsights()">👁️ ${s.view_count || 0} views</span>`;
    }
    reactionsDisplay.innerHTML = reactHtml;
    // Highlight user's reaction
    document.querySelectorAll('.story-emoji-bar button').forEach(btn => btn.classList.remove('active-reaction'));
    if (s.user_reaction) {
        document.querySelectorAll('.story-emoji-bar button').forEach(btn => {
            if (btn.textContent.trim() === s.user_reaction) btn.classList.add('active-reaction');
        });
    }
    let contentHtml = '';
    if (s.media_url) {
        if (s.media_url.startsWith('data:video/')) {
            contentHtml = `<video src="${s.media_url}" style="max-width:100%;max-height:50vh;border-radius:0.5rem;" controls autoplay muted></video>`;
        } else {
            contentHtml = `<img src="${s.media_url}" style="max-width:100%;max-height:50vh;border-radius:0.5rem;object-fit:contain;" />`;
        }
        if (s.content) contentHtml += `<p style="margin-top:0.75rem;font-size:1rem;">${esc(s.content)}</p>`;
    } else {
        contentHtml = `<p>${esc(s.content)}</p>`;
    }
    document.getElementById('storyViewerContent').innerHTML = contentHtml;
    document.getElementById('storyReplyInput').value = '';
    closeStoryMenu();
    // Track view
    if (!s.is_own) {
        fetch(`/api/stories/${s.id}/view`, { method:'POST' }).catch(() => {});
    }
}

function showStoryInsights() {
    const s = storyViewData[storyViewIndex];
    if (!s || !s.is_own) return;
    let html = '<div style="background:rgba(0,0,0,0.85);position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)this.remove()">';
    html += '<div style="background:white;color:#333;width:100%;max-width:420px;max-height:60vh;border-radius:1rem 1rem 0 0;overflow-y:auto;padding:1rem;">';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;"><h3 style="margin:0;">👁️ ${s.view_count || 0} Views</h3><button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button></div>`;
    if (s.reactors && s.reactors.length > 0) {
        html += '<div style="margin-bottom:1rem;"><div style="font-weight:700;font-size:0.85rem;color:#7c3aed;margin-bottom:0.5rem;">Reactions</div>';
        s.reactors.forEach(r => {
            html += `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0;"><span style="font-size:1.2rem;">${r.reaction}</span><span style="font-weight:600;">${esc(r.username)}</span></div>`;
        });
        html += '</div>';
    }
    if (s.viewers && s.viewers.length > 0) {
        html += '<div><div style="font-weight:700;font-size:0.85rem;color:#666;margin-bottom:0.5rem;">Viewers</div>';
        s.viewers.forEach(v => {
            html += `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0;"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;">${v.username[0].toUpperCase()}</div><span style="font-weight:600;">${esc(v.username)}</span></div>`;
        });
        html += '</div>';
    }
    if ((!s.viewers || s.viewers.length === 0) && (!s.reactors || s.reactors.length === 0)) {
        html += '<p style="text-align:center;color:#999;padding:1rem;">No views yet</p>';
    }
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
}

async function reactToStory(emoji) {
    const s = storyViewData[storyViewIndex];
    if (!s) return;
    await fetch(`/api/stories/${s.id}/react`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reaction: emoji}) });
    // Refresh story data
    const res = await fetch('/api/stories');
    const groups = await res.json();
    const group = groups.find(g => g.stories.some(st => st.id === s.id));
    if (group) {
        storyViewData = group.stories;
        showStorySlide();
    }
}

async function sendStoryReply() {
    const s = storyViewData[storyViewIndex];
    if (!s) return;
    const input = document.getElementById('storyReplyInput');
    const message = input.value.trim();
    if (!message) return;
    const res = await fetch(`/api/stories/${s.id}/reply`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message}) });
    if (res.ok) {
        input.value = '';
        showToast('Reply sent!');
    }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:0.6rem 1.2rem;border-radius:2rem;font-size:0.85rem;z-index:99999;animation:fadeIn 0.2s ease;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

function toggleStoryMenu() {
    const menu = document.getElementById('storyMenu');
    menu.classList.toggle('open');
}
function closeStoryMenu() {
    const menu = document.getElementById('storyMenu');
    if (menu) menu.classList.remove('open');
}
function deleteCurrentStory() {
    const s = storyViewData[storyViewIndex];
    if (s) deleteStory(s.id);
}

function nextStory() {
    if (storyViewIndex < storyViewData.length - 1) { storyViewIndex++; showStorySlide(); }
    else closeModal('storyViewModal');
}
function prevStory() {
    if (storyViewIndex > 0) { storyViewIndex--; showStorySlide(); }
}

// ─── REPORTS ───
let reportContext = {};
let selectedReportReason = 'spam';

function openReportModal(type, targetId) {
    reportContext = { type, targetId };
    if (type === 'user') reportContext.targetId = currentChatUserId;
    document.getElementById('reportModal').classList.add('open');
}

function toggleCustomSelect(id) {
    const el = document.getElementById(id);
    el.classList.toggle('open');
}

function pickReportReason(opt) {
    selectedReportReason = opt.dataset.value;
    document.getElementById('reportReasonLabel').textContent = opt.textContent;
    opt.closest('.custom-select').querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.closest('.custom-select').classList.remove('open');
}

async function submitReport() {
    const reason = selectedReportReason;
    const details = document.getElementById('reportDetails').value.trim();
    const body = { reason, details };
    if (reportContext.type === 'user') body.reported_user_id = reportContext.targetId;
    else if (reportContext.type === 'post') body.reported_post_id = reportContext.targetId;
    else if (reportContext.type === 'message') body.reported_message_id = reportContext.targetId;
    try {
        const res = await fetch('/api/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await res.json();
        alert(data.message || 'Report submitted');
        closeModal('reportModal');
        document.getElementById('reportDetails').value = '';
    } catch { alert('Failed to submit report'); }
}

// ─── SIDEBAR ───
function openSidebar() {
    document.getElementById('profileSidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
    loadAccountSwitcher();
}
function closeSidebarFn() {
    document.getElementById('profileSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    document.body.style.overflow = 'auto';
}

async function loadAccountSwitcher() {
    const list = document.getElementById('accountSwitcherList');
    if (!list) return;
    try {
        const res = await fetch('/api/all-users');
        const data = await res.json();
        const users = data.users || [];
        const currentId = data.current_id;
        if (users.length === 0) { list.innerHTML = '<div style="color:#999;font-size:0.85rem;padding:0.5rem;">No accounts</div>'; return; }
        list.innerHTML = users.map(u => {
            const isCurrent = u.id === currentId;
            return `
            <div class="account-item ${isCurrent ? 'current' : ''}" onclick="${isCurrent ? '' : `quickSwitch(${u.id})`}">
                <div class="account-avatar">${(u.username || 'U')[0].toUpperCase()}</div>
                <div class="account-info">
                    <div class="account-name">${u.username}</div>
                    <div class="account-detail">${u.company || ''} ${u.role ? '· ' + u.role : ''}</div>
                </div>
                ${isCurrent ? '<span class="account-check">✓</span>' : ''}
            </div>`;
        }).join('');
    } catch { list.innerHTML = '<div style="color:#999;font-size:0.85rem;padding:0.5rem;">Failed to load</div>'; }
}

async function quickSwitch(userId) {
    try {
        const res = await fetch('/api/quick-switch', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId}) });
        if (res.ok) { location.reload(); }
        else { const d = await res.json(); alert(d.error || 'Switch failed'); }
    } catch (e) { alert('Switch failed: ' + e.message); }
}

// ─── PUBLIC FEED ───
async function loadPublicFeed() {
    const list = document.getElementById('publicFeedList');
    if (!list) return;
    try {
        const res = await fetch('/api/posts/public');
        const posts = await res.json();
        if (posts.length === 0) { list.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">No posts yet</p>'; return; }
        list.innerHTML = posts.map(p => {
            const avatarLetter = (p.username || 'U')[0].toUpperCase();
            return `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-avatar">${avatarLetter}</div>
                    <div class="post-author-info">
                        <span class="post-author-name">${esc(p.username)}</span>
                        <span class="post-author-detail">${esc(p.company || '')} ${p.role ? '· ' + esc(p.role) : ''} · ${timeAgo(p.created_at)}</span>
                    </div>
                    <span class="post-type ${p.type}">${p.type === 'problem' ? '🔴 Problem' : p.type === 'solution' ? '🟢 Solution' : p.type === 'achievement' ? '🏆 Achievement' : '🔵 Discussion'}</span>
                </div>
                <h3>${esc(p.title)}</h3>
                <div class="post-body">${esc(p.content).substring(0, 200)}${p.content.length > 200 ? '...' : ''}</div>
                ${p.tags ? `<div class="post-tags">${p.tags.split(',').map(t => `<span class="tag">#${t.trim()}</span>`).join('')}</div>` : ''}
                <div style="text-align:center;padding-top:0.5rem;"><span style="color:var(--accent);font-size:0.85rem;cursor:pointer;" onclick="showLoginForm();document.getElementById('loginOverlay').style.display='flex'">Login to interact →</span></div>
            </div>`;
        }).join('');
    } catch {}
}

// ─── MESSAGE TAB SWITCHING ───
function showMsgTab(tab, btn) {
    document.querySelectorAll('#messagesConvoView .net-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('msgDmsSection').style.display = tab === 'dms' ? 'block' : 'none';
    document.getElementById('msgGroupsSection').style.display = tab === 'groups' ? 'block' : 'none';
    if (tab === 'groups') loadGroups();
}

// ─── GROUPS ───
let currentGroupId = null;

async function loadGroups() {
    const list = document.getElementById('groupList');
    if (!list) return;
    try {
        const res = await fetch('/api/groups');
        const groups = await res.json();
        if (groups.length === 0) { list.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">No groups yet. Create one!</p>'; return; }
        list.innerHTML = groups.map(g => `
            <div class="convo-card" onclick="openGroupChat(${g.id}, '${esc(g.name)}')">
                <div class="convo-avatar" style="background:${g.avatar_color || '#7c3aed'};">${g.name[0].toUpperCase()}</div>
                <div class="convo-info">
                    <div class="convo-name">${esc(g.name)}</div>
                    <div class="convo-preview">${g.member_count} members</div>
                </div>
            </div>
        `).join('');
    } catch {}
}

async function openCreateGroup() {
    document.getElementById('groupModal').classList.add('open');
    const res = await fetch('/api/connections');
    const conns = await res.json();
    const picker = document.getElementById('groupMemberPicker');
    picker.innerHTML = conns.map(c => `
        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">
            <input type="checkbox" class="group-member-cb" value="${c.id}" />
            <span style="font-weight:600;font-size:0.9rem;">${esc(c.username)}</span>
            <span style="color:#999;font-size:0.8rem;">${esc(c.company || '')}</span>
        </label>
    `).join('') || '<p style="color:#999;font-size:0.85rem;">Connect with people first to add them</p>';
}

async function submitCreateGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) { alert('Group name required'); return; }
    const desc = document.getElementById('groupDesc').value.trim();
    const memberIds = [...document.querySelectorAll('.group-member-cb:checked')].map(cb => parseInt(cb.value));
    await fetch('/api/groups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, description:desc, member_ids:memberIds}) });
    closeModal('groupModal');
    document.getElementById('groupName').value = '';
    document.getElementById('groupDesc').value = '';
    loadGroups();
}

async function openGroupChat(groupId, name) {
    currentGroupId = groupId;
    currentChatUserId = null;
    switchTabByName('messages');
    document.getElementById('messagesConvoView').style.display = 'none';
    const chatView = document.getElementById('messagesChatView');
    chatView.style.display = 'flex';
    document.getElementById('chatUserAvatar').textContent = name[0].toUpperCase();
    document.getElementById('inlineChatTitle').innerHTML = `<span style="cursor:pointer;" onclick="openGroupInfo(${groupId})">${esc(name)}</span> <span style="font-size:0.75rem;color:#999;font-weight:400;">group</span>`;
    document.getElementById('replyPreview').style.display = 'none';
    loadGroupMessages();
    loadGroupMembersForMention(groupId);
}

let groupMembersForMention = [];

async function loadGroupMembersForMention(groupId) {
    try {
        const res = await fetch(`/api/groups/${groupId}`);
        const data = await res.json();
        groupMembersForMention = (data.members || []).map(m => ({id: m.user_id, username: m.username, company: m.company || '', role: m.user_role || ''}));
    } catch { groupMembersForMention = []; }
}

async function openGroupInfo(groupId) {
    const res = await fetch(`/api/groups/${groupId}`);
    const g = await res.json();
    if (g.error) return;
    const members = g.members || [];
    const isAdmin = members.some(m => m.user_id === (window._profileData?.id) && m.role === 'admin');

    let html = `
        <div style="text-align:center;padding-bottom:1rem;border-bottom:1px solid var(--border);">
            <div style="width:64px;height:64px;border-radius:50%;background:${g.avatar_color || '#7c3aed'};color:white;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;margin:0 auto;">${g.name[0].toUpperCase()}</div>
            <h3 style="margin-top:0.5rem;">${esc(g.name)}</h3>
            ${g.description ? `<p style="color:var(--text-secondary);font-size:0.85rem;">${esc(g.description)}</p>` : ''}
            <p style="color:#999;font-size:0.8rem;">${members.length} members · Max 150</p>
        </div>
        <div style="padding:0.75rem 0;">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.5rem;">👥 Members (${members.length})</div>
            ${members.map(m => `
                <div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;">
                    <div class="mention-avatar">${m.username[0].toUpperCase()}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:0.9rem;">${esc(m.username)} ${m.role === 'admin' ? '<span style="font-size:0.7rem;color:var(--accent);font-weight:700;">ADMIN</span>' : ''}</div>
                        <div style="font-size:0.75rem;color:#999;">${esc(m.company || '')} ${m.user_role ? '· ' + esc(m.user_role) : ''}</div>
                    </div>
                    ${isAdmin && m.role !== 'admin' ? `<button class="btn-outline btn-sm" style="font-size:0.7rem;padding:0.25rem 0.5rem;" onclick="removeGroupMember(${groupId}, ${m.user_id})">Remove</button>` : ''}
                </div>
            `).join('')}
        </div>
        ${isAdmin ? `<button class="btn-primary btn-sm" style="width:100%;margin-bottom:0.5rem;" onclick="addMemberToGroup(${groupId})">+ Add Member</button>` : ''}
        <div style="display:flex;flex-direction:column;gap:0.5rem;padding-top:0.75rem;border-top:1px solid var(--border);">
            <button class="btn-outline btn-sm" style="width:100%;color:var(--danger);border-color:var(--danger);" onclick="leaveGroup(${groupId})">🚪 Exit Group</button>
            <button class="btn-outline btn-sm" style="width:100%;" onclick="openReportModal('group', ${groupId})">⚠️ Report Group</button>
        </div>
    `;
    showProfileSheet(`${esc(g.name)}`, html);
}

async function removeGroupMember(groupId, userId) {
    const ok = await customConfirm('Remove this member?');
    if (!ok) return;
    await fetch(`/api/groups/${groupId}/members/${userId}`, { method:'DELETE' });
    showToast('Member removed');
    openGroupInfo(groupId);
}

async function leaveGroup(groupId) {
    const ok = await customConfirm('Leave this group?');
    if (!ok) return;
    await fetch(`/api/groups/${groupId}/leave`, { method:'POST' });
    showToast('Left group');
    closeProfileSheet();
    backToConversations();
    loadGroups();
}

async function addMemberToGroup(groupId) {
    const res = await fetch('/api/connections');
    const conns = await res.json();
    let html = '<div style="padding:0.5rem;">';
    html += conns.map(c => `
        <div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;">
            <div class="mention-avatar">${c.username[0].toUpperCase()}</div>
            <div style="flex:1;"><div style="font-weight:600;font-size:0.9rem;">${esc(c.username)}</div></div>
            <button class="btn-primary btn-sm" style="font-size:0.75rem;padding:0.25rem 0.5rem;" onclick="doAddMember(${groupId}, ${c.id}, this)">Add</button>
        </div>
    `).join('') || '<p style="color:#999;">No connections to add</p>';
    html += '</div>';
    showProfileSheet('+ Add Member', html);
}

async function doAddMember(groupId, userId, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '...'; }
    const res = await fetch(`/api/groups/${groupId}/members`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id: userId}) });
    const data = await res.json();
    if (btn) { btn.innerHTML = data.error ? 'Failed' : '✓'; }
    if (!data.error) showToast('Member added');
}

async function loadGroupMessages() {
    if (!currentGroupId) return;
    const res = await fetch(`/api/groups/${currentGroupId}/messages`);
    const msgs = await res.json();
    const container = document.getElementById('inlineChatMessages');
    if (msgs.length === 0) { container.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">Start the conversation</p>'; return; }
    container.innerHTML = msgs.map(m => {
        const avatarLetter = (m.username || 'U')[0].toUpperCase();
        return `
        <div class="msg-row received" id="msg-${m.id}">
            <div class="msg-avatar">${avatarLetter}</div>
            <div class="msg-bubble-wrap">
                <div style="font-size:0.7rem;font-weight:700;color:#7c3aed;margin-bottom:0.1rem;">${esc(m.username)}</div>
                <div class="msg-bubble received">
                    ${m.file_url ? `<div style="margin-bottom:0.25rem;">📎 <a href="${m.file_url}" target="_blank" style="color:inherit;">${esc(m.file_name || 'File')}</a></div>` : ''}
                    ${esc(m.message)}
                    <span class="time">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
            </div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

// ─── CHAT FILE ATTACH ───
let chatFileBase64 = null;
let chatFileName = null;

function attachChatFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); input.value = ''; return; }
    chatFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        chatFileBase64 = e.target.result;
        document.getElementById('chatFileName').textContent = file.name;
        document.getElementById('chatFilePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function clearChatFile() {
    chatFileBase64 = null;
    chatFileName = null;
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatFileInput').value = '';
}

function toggleChatEmoji() {
    const picker = document.getElementById('chatEmojiPicker');
    const isHidden = picker.style.display === 'none';
    picker.style.display = isHidden ? 'block' : 'none';
    if (isHidden) showEmojiCat('smileys', document.querySelector('.emoji-tab'));
    closeChatPlusMenu();
}

const emojiData = {
    smileys: ['😊','😂','🤣','😍','🥰','😘','😜','🤪','😎','🤩','🥳','😇','🤗','🤭','🤫','🤔','😏','😌','😴','🥱','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥸','😈','👻','💀','☠️','👽','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    people: ['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🫄','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','👯','🧖','🧗','🤸','⛹️','🏋️','🚴','🚵','🤼','🤽','🤾','🤺','🏇','⛷️','🏂','🏌️','🏄','🚣','🏊','🤹'],
    gestures: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🖕','✍️','🤳','💅','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄'],
    hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏','💋','😍','🥰','😘','😻','💌','🌹','🫀','❤️‍🔥','❤️‍🩹'],
    animals: ['🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪲','🐢','🐍','🦎','🐙','🦑','🦀','🐠','🐟','🐬','🐳','🦈','🐊'],
    food: ['🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌮','🌯','🥙','🧆','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧃','🥤','🍺','🍷','🥂','🍾'],
    activity: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','🎯','🪀','🎮','🕹️','🎲','🧩','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎪','🎠','🎡','🎢','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️'],
    travel: ['✈️','🛫','🛬','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🏘️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'],
    weather: ['☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌈','🌅','🌄','🌇','🌆','🌃','🌉','🌌','🌠','🌟','⭐','🌙','🌛','🌜','🌝','🌞','💫','✨','☄️','🔥','💧','🌊','🌍','🌎','🌏','🪐','💥','⚡','❄️','🌡️','☔','⛱️','🌂','☂️'],
    objects: ['💼','📱','💻','⌨️','🖥️','🖨️','📷','📹','🎥','📞','☎️','📺','📻','🎙️','🎚️','🎛️','⏱️','⏰','🔔','🔕','📢','📣','💡','🔦','🕯️','📚','📖','📝','✏️','🖊️','📎','📌','📍','✂️','🗑️','🔒','🔓','🔑','🔨','⚙️','💰','💳','📦','📫','📧'],
    symbols: ['✅','❌','⭕','❗','❓','‼️','⁉️','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','💠','🔘','✔️','☑️','➕','➖','➗','✖️','♾️','💲','💱','©️','®️','™️','⬆️','⬇️','⬅️','➡️','↗️','↘️','↙️','↖️','↕️','↔️','🔄','🔃','🔀','🔁','🔂','▶️','⏩','⏭️','⏯️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬'],
    flags: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇮🇳','🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇧🇷','🇯🇵','🇰🇷','🇨🇳','🇷🇺','🇲🇽','🇦🇷','🇸🇦','🇦🇪','🇸🇬','🇮🇩','🇹🇭','🇻🇳','🇵🇭','🇲🇾','🇳🇬','🇿🇦','🇰🇪','🇪🇬','🇵🇰','🇧🇩','🇱🇰','🇳🇵','🇳🇿','🇮🇪','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇺🇦','🇹🇷','🇬🇷','🇵🇹','🇮🇱','🇶🇦','🇰🇼','🇴🇲','🇯🇴','🇱🇧']
};

function showEmojiCat(cat, btn) {
    document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const grid = document.getElementById('emojiGrid');
    const emojis = emojiData[cat] || [];
    grid.innerHTML = emojis.map(e => `<button onclick="insertChatEmoji('${e}')">${e}</button>`).join('');
}

function insertChatEmoji(emoji) {
    const input = document.getElementById('inlineChatInput');
    input.value += emoji;
    input.focus();
}

function toggleChatPlusMenu() {
    const menu = document.getElementById('chatPlusMenu');
    menu.classList.toggle('open');
    document.getElementById('chatEmojiPicker').style.display = 'none';
}

function closeChatPlusMenu() {
    const menu = document.getElementById('chatPlusMenu');
    if (menu) menu.classList.remove('open');
}

function openScheduleMsg() {
    closeChatPlusMenu();
    const msg = document.getElementById('inlineChatInput').value.trim();
    if (!msg) { showToast('Type a message first'); return; }
    // Set default date/time to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('schedDate').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('schedTime').value = '09:00';
    document.getElementById('scheduleSheet').classList.add('open');
}

function closeScheduleSheet() {
    document.getElementById('scheduleSheet').classList.remove('open');
}

async function sendScheduledMsg() {
    const msg = document.getElementById('inlineChatInput').value.trim();
    if (!msg) { showToast('Type a message first'); return; }
    const date = document.getElementById('schedDate').value;
    const time = document.getElementById('schedTime').value;
    if (!date || !time) { showToast('Pick date and time'); return; }
    const scheduled_at = `${date} ${time}:00`;
    const body = { message: msg, scheduled_at };
    if (currentGroupId) {
        await fetch(`/api/groups/${currentGroupId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    } else if (currentChatUserId) {
        body.receiver_id = currentChatUserId;
        await fetch('/api/messages/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    }
    document.getElementById('inlineChatInput').value = '';
    closeScheduleSheet();
    showToast(`Message scheduled for ${date} ${time}`);
}

let deliveryOpts = { readReceipt: true, priority: false, silent: false };

function openDeliveryOpts() {
    closeChatPlusMenu();
    document.getElementById('optReadReceipt').checked = deliveryOpts.readReceipt;
    document.getElementById('optPriority').checked = deliveryOpts.priority;
    document.getElementById('optSilent').checked = deliveryOpts.silent;
    document.getElementById('deliverySheet').classList.add('open');
}

function closeDeliverySheet() {
    document.getElementById('deliverySheet').classList.remove('open');
}

function applyDeliveryOpts() {
    deliveryOpts.readReceipt = document.getElementById('optReadReceipt').checked;
    deliveryOpts.priority = document.getElementById('optPriority').checked;
    deliveryOpts.silent = document.getElementById('optSilent').checked;
    closeDeliverySheet();
    let status = [];
    if (deliveryOpts.priority) status.push('🔴 Priority');
    if (deliveryOpts.silent) status.push('🔕 Silent');
    if (!deliveryOpts.readReceipt) status.push('No read receipts');
    showToast(status.length ? status.join(', ') + ' applied' : 'Default delivery');
}

function recordVideoClip() {
    closeChatPlusMenu();
    showToast('🎥 Video recording coming soon!');
}

// ─── @MENTIONS ───
let mentionConnections = [];
let mentionActiveDropdown = null;
let mentionActiveInput = null;
let mentionSelectedIndex = 0;

async function loadMentionConnections() {
    try {
        const res = await fetch('/api/connections');
        mentionConnections = await res.json();
    } catch { mentionConnections = []; }
}

function handleMentionInput(input, dropdownId) {
    const val = input.value || input.textContent || '';
    const cursorPos = input.selectionStart || val.length;
    const textBefore = val.substring(0, cursorPos);
    const match = textBefore.match(/@(\w*)$/);
    const dropdown = document.getElementById(dropdownId);

    if (match) {
        const query = match[1].toLowerCase();
        // Use group members if in group chat, otherwise connections
        let pool = mentionConnections;
        if (currentGroupId && groupMembersForMention.length > 0 && dropdownId === 'chatMentionDropdown') {
            pool = groupMembersForMention;
        }
        if (pool.length === 0) loadMentionConnections();
        const filtered = pool.filter(c =>
            c.username.toLowerCase().includes(query)
        ).slice(0, 8);

        if (filtered.length > 0) {
            mentionActiveDropdown = dropdown;
            mentionActiveInput = input;
            mentionSelectedIndex = 0;
            dropdown.innerHTML = filtered.map((c, i) => `
                <div class="mention-item ${i === 0 ? 'active' : ''}" onmousedown="insertMention('${esc(c.username)}', '${dropdownId}')">
                    <div class="mention-avatar">${c.username[0].toUpperCase()}</div>
                    <div>
                        <div class="mention-name">${esc(c.username)}</div>
                        <div class="mention-detail">${esc(c.company || '')} ${c.role ? '· ' + esc(c.role) : ''}</div>
                    </div>
                </div>
            `).join('');
            dropdown.classList.add('open');
        } else {
            dropdown.classList.remove('open');
        }
    } else {
        dropdown.classList.remove('open');
    }
}

function insertMention(username, dropdownId) {
    const input = mentionActiveInput;
    if (!input) return;
    const val = input.value || '';
    const cursorPos = input.selectionStart || val.length;
    const textBefore = val.substring(0, cursorPos);
    const textAfter = val.substring(cursorPos);
    const newBefore = textBefore.replace(/@\w*$/, '@' + username + ' ');
    input.value = newBefore + textAfter;
    input.focus();
    input.selectionStart = input.selectionEnd = newBefore.length;
    document.getElementById(dropdownId).classList.remove('open');
}

// Keyboard navigation for mention dropdown
document.addEventListener('keydown', (e) => {
    if (!mentionActiveDropdown || !mentionActiveDropdown.classList.contains('open')) return;
    const items = mentionActiveDropdown.querySelectorAll('.mention-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionSelectedIndex = Math.min(mentionSelectedIndex + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('active', i === mentionSelectedIndex));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionSelectedIndex = Math.max(mentionSelectedIndex - 1, 0);
        items.forEach((it, i) => it.classList.toggle('active', i === mentionSelectedIndex));
    } else if (e.key === 'Enter' && items[mentionSelectedIndex]) {
        e.preventDefault();
        items[mentionSelectedIndex].dispatchEvent(new Event('mousedown'));
    } else if (e.key === 'Escape') {
        mentionActiveDropdown.classList.remove('open');
    }
});

// Load connections for mentions on init
loadMentionConnections();

// ─── CUSTOM CONFIRM DIALOG ───
let confirmResolve = null;
function customConfirm(msg) {
    return new Promise(resolve => {
        confirmResolve = resolve;
        document.getElementById('confirmDialogMsg').textContent = msg;
        document.getElementById('confirmDialog').classList.add('open');
    });
}
function resolveConfirm(val) {
    document.getElementById('confirmDialog').classList.remove('open');
    if (confirmResolve) { confirmResolve(val); confirmResolve = null; }
}

// ─── UTILS ───
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
async function confirmLogout() {
    const ok = await customConfirm('Logout?');
    if (ok) { fetch('/api/logout', {method:'POST'}).then(() => location.href = '/'); }
}
