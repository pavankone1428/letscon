// ─── GLOBALS ───
let currentChatUserId = null;
let currentCommentPostId = null;
let emojiPickerTimeout = null;

// ─── INIT ───
document.addEventListener('DOMContentLoaded', initApp);

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
        if (!e.target.closest('.post-more-btn')) {
            document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
        }
    });

    loadFeed();
    loadStories();
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
                    <button class="post-action-btn like-btn ${p.user_vote === 1 ? 'active' : ''}" onclick="vote(${p.id}, 1, '${userReaction}')" oncontextmenu="showEmojiPicker(event, ${p.id})" ontouchstart="startLongPress(event, ${p.id})" ontouchend="cancelLongPress()">
                        ${p.user_vote === 1 ? getReactionEmoji(userReaction) : '👍'} Like ${totalLikes > 0 ? totalLikes : ''}
                    </button>
                    <button class="post-action-btn ${p.user_vote === -1 ? 'active-dislike' : ''}" onclick="vote(${p.id}, -1)">👎 Dislike</button>
                    <button class="post-action-btn" onclick="openComments(${p.id})">💬 ${p.comment_count || ''}</button>
                    <button class="post-action-btn ${p.user_bookmarked ? 'active-bookmark' : ''}" onclick="bookmark(${p.id})">🔖</button>
                    <button class="post-action-btn" onclick="sharePost(${p.id}, '${esc(p.title)}')">🔗</button>
                    <button class="post-action-btn post-more-btn" onclick="togglePostMenu(${p.id})">⋯
                        <div class="post-menu" id="postMenu-${p.id}">
                            ${p.is_own ? `<button onclick="event.stopPropagation();deletePost(${p.id})">🗑️ Delete</button>` : ''}
                            <button onclick="event.stopPropagation();openReportModal('post', ${p.id})">⚠️ Report</button>
                        </div>
                    </button>
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
    document.querySelectorAll('.post-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
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
function openComments(postId) {
    currentCommentPostId = postId;
    document.getElementById('commentsModal').classList.add('open');
    loadComments(postId);
}

async function loadComments(postId) {
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">Loading...</p>';
    const res = await fetch(`/api/posts/${postId}/comments`);
    const comments = await res.json();
    if (comments.length === 0) { list.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">No comments yet</p>'; return; }
    list.innerHTML = comments.map(c => `
        <div class="comment-item">
            <span class="comment-author">${esc(c.username)}</span>
            <span class="comment-company">${c.company ? ' · ' + esc(c.company) : ''}</span>
            <div class="comment-text">${esc(c.content)}</div>
            <div class="comment-time">${new Date(c.created_at).toLocaleString()}</div>
        </div>
    `).join('');
}

async function submitComment() {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content || !currentCommentPostId) return;
    await fetch(`/api/posts/${currentCommentPostId}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content}) });
    input.value = '';
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
                    ${u.connection_status === null ? `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id})">Connect</button>` :
                      u.connection_status === 'pending' && u.is_sender ? `<button class="btn-outline btn-sm" disabled>Pending</button>` :
                      u.connection_status === 'pending' && !u.is_sender ? `<button class="btn-primary btn-sm btn-accent" onclick="acceptFromNotif(${u.id})">Accept</button>` :
                      u.connection_status === 'accepted' ? `<button class="btn-primary btn-sm" onclick="openChat(${u.id}, '${esc(u.username)}')">Message</button>` :
                      `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id})">Connect</button>`}
                </div>
            </div>
        `).join('');
    } catch { list.innerHTML = '<p style="color:#dc3545;text-align:center;">Failed to load</p>'; }
}

async function sendRequest(userId) {
    await fetch('/api/connections/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({receiver_id:userId}) });
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
                    <div class="company-role" style="font-size:0.95rem;">${esc(u.company || '')} ${u.role ? '· ' + esc(u.role) : ''}</div>
                    <div style="color:#999;font-size:0.85rem;margin-top:0.25rem;">${u.connections_count} connection${u.connections_count !== 1 ? 's' : ''}</div>
                    ${u.is_restricted ? '<div style="color:#f59e0b;font-size:0.85rem;margin-top:0.5rem;">🔒 Private profile — connect to see full details</div>' : ''}
                </div>

                <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;">
                    ${u.is_connected ? `<button class="btn-primary btn-sm" onclick="openChat(${u.id}, '${esc(u.username)}')">💬 Message</button>` : ''}
                    ${u.is_connected ? '' : `<button class="btn-primary btn-sm" onclick="sendRequest(${u.id})">+ Connect</button>`}
                </div>`;

    if (!u.is_restricted) {
        html += `
                ${u.experience ? `<div class="profile-detail-row">📅 ${u.experience} years experience</div>` : ''}
                ${u.bio ? `<div class="profile-detail-row" style="line-height:1.5;">${esc(u.bio)}</div>` : ''}
                ${u.skills ? `<div class="profile-skills" style="justify-content:center;">${u.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('')}</div>` : ''}
                <div class="profile-links" style="justify-content:center;">
                    ${u.linkedin ? `<a href="${esc(u.linkedin)}" target="_blank">🔗 LinkedIn</a>` : ''}
                    ${u.github ? `<a href="${esc(u.github)}" target="_blank">💻 GitHub</a>` : ''}
                </div>
                ${u.resume ? `<div style="text-align:center;margin-top:0.5rem;"><button class="btn-outline btn-sm" onclick="viewResume(${u.id})">📄 View Resume</button></div>` : ''}
        `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

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
    if (!msg || !currentChatUserId) return;
    const body = { receiver_id: currentChatUserId, message: msg };
    if (currentReplyToId) body.reply_to_id = currentReplyToId;
    await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    input.value = '';
    cancelReply();
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

    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-top">
                <div class="profile-avatar">${(p.username || 'U')[0].toUpperCase()}</div>
                <div class="profile-info">
                    <h2>${esc(p.username)}</h2>
                    <div class="company-role">${esc(p.company || '')} ${p.role ? '· ' + esc(p.role) : ''}</div>
                    ${p.experience ? `<div style="color:#666;font-size:0.9rem;">${p.experience} years experience</div>` : ''}
                    ${p.bio ? `<div class="bio">${esc(p.bio)}</div>` : ''}
                </div>
            </div>

            <div class="profile-stats">
                <div class="pstat"><div class="num">${p.connections_count || 0}</div><div class="lbl">Connections</div></div>
                <div class="pstat"><div class="num">${p.posts_count || 0}</div><div class="lbl">Posts</div></div>
            </div>

            ${p.skills ? `<div class="profile-skills">${p.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('')}</div>` : ''}

            <div class="profile-links">
                ${p.linkedin ? `<a href="${esc(p.linkedin)}" target="_blank">🔗 LinkedIn</a>` : ''}
                ${p.github ? `<a href="${esc(p.github)}" target="_blank">💻 GitHub</a>` : ''}
            </div>

            <div class="profile-resume-section">
                <h3 style="font-size:1rem;margin-bottom:0.5rem;">📄 Resume</h3>
                ${p.resume ? `<div style="display:flex;gap:0.5rem;align-items:center;">
                    <span style="color:#28a745;font-size:0.9rem;">✓ Resume uploaded</span>
                    <button class="btn-outline btn-sm" onclick="viewMyResume()">View</button>
                    <button class="btn-outline btn-sm" onclick="document.getElementById('resumeInput').click()">Replace</button>
                </div>` : `<button class="btn-outline" onclick="document.getElementById('resumeInput').click()">Upload Resume (PDF)</button>`}
                <input type="file" id="resumeInput" accept=".pdf" style="display:none;" onchange="handleResumeUpload(event)" />
            </div>

            <div class="referral-toggle">
                <label class="toggle-switch">
                    <input type="checkbox" id="refToggle" ${p.available_for_referral ? 'checked' : ''} onchange="toggleReferralAvailability()">
                    <span class="toggle-slider"></span>
                </label>
                <span style="font-weight:600;">Available for referrals</span>
            </div>

            <div class="referral-toggle">
                <label class="toggle-switch">
                    <input type="checkbox" id="privacyToggle" ${p.is_private ? 'checked' : ''} onchange="togglePrivacy()">
                    <span class="toggle-slider"></span>
                </label>
                <div style="flex:1;min-width:0;">
                    <span style="font-weight:600;">Private Profile</span>
                    <div style="font-size:0.8rem;color:#999;">Only connections can see your full profile & resume</div>
                </div>
            </div>

            <button class="btn-primary" onclick="openEditProfile()" style="margin-top:1rem;">Edit Profile</button>
        </div>

        <div id="editProfileForm" style="display:none;margin-top:1rem;" class="profile-card">
            <h3 style="margin-bottom:1rem;">Edit Profile</h3>
            <div class="form-group"><label>Full Name</label><input type="text" id="editName" value="${esc(p.username)}" /></div>
            <div class="form-group"><label>Company</label><input type="text" id="editCompany" value="${esc(p.company || '')}" /></div>
            <div class="form-group"><label>Role</label><input type="text" id="editRole" value="${esc(p.role || '')}" /></div>
            <div class="form-group"><label>Experience (years)</label><input type="number" id="editExp" value="${p.experience || 0}" /></div>
            <div class="form-group"><label>Bio</label><textarea id="editBio" rows="3">${esc(p.bio || '')}</textarea></div>
            <div class="form-group"><label>Skills (comma separated)</label><input type="text" id="editSkills" value="${esc(p.skills || '')}" /></div>
            <div class="form-group"><label>LinkedIn URL</label><input type="text" id="editLinkedin" value="${esc(p.linkedin || '')}" /></div>
            <div class="form-group"><label>GitHub URL</label><input type="text" id="editGithub" value="${esc(p.github || '')}" /></div>
            <div style="display:flex;gap:0.5rem;">
                <button class="btn-primary" onclick="saveProfile()">Save</button>
                <button class="btn-outline" onclick="document.getElementById('editProfileForm').style.display='none'">Cancel</button>
            </div>
        </div>
    `;
}

function openEditProfile() { document.getElementById('editProfileForm').style.display = 'block'; }

async function saveProfile() {
    const data = {
        username: document.getElementById('editName').value.trim(),
        company: document.getElementById('editCompany').value.trim(),
        role: document.getElementById('editRole').value.trim(),
        experience: parseInt(document.getElementById('editExp').value) || 0,
        bio: document.getElementById('editBio').value.trim(),
        skills: document.getElementById('editSkills').value.trim(),
        linkedin: document.getElementById('editLinkedin').value.trim(),
        github: document.getElementById('editGithub').value.trim(),
        available_for_referral: document.getElementById('refToggle')?.checked || false,
        is_private: document.getElementById('privacyToggle')?.checked || false
    };
    try {
        const res = await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const result = await res.json();
        if (res.ok) { alert('Profile updated!'); loadProfile(); }
        else alert('Error: ' + (result.error || 'Failed'));
    } catch (e) { alert('Failed: ' + e.message); }
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
