const statusMessage = document.getElementById("issue-status");
const detailContainer = document.getElementById("issue-detail");
const commentsStatus = document.getElementById("comments-status");
const commentsList = document.getElementById("comments-list");
const nearbyStatus = document.getElementById("nearby-status");
const nearbyList = document.getElementById("nearby-list");
const nearbyPagination = document.getElementById("nearby-pagination");
const nearbyPrevButton = document.getElementById("nearby-prev");
const nearbyNextButton = document.getElementById("nearby-next");
const nearbyPageLabel = document.getElementById("nearby-page");
const nearbySortSelect = document.getElementById("nearby-sort");
const nearbyMapElement = document.getElementById("nearby-map");
const nearbyCreatedStart = document.getElementById("nearby-created-start");
const nearbyCreatedEnd = document.getElementById("nearby-created-end");
const nearbyCreatedLabel = document.getElementById("nearby-created-range");

const NEARBY_RADIUS_FEET = 400;
const NEARBY_PAGE_SIZE = 10;
const ALL_STATUSES = "open,acknowledged,closed,archived";
let nearbyIssues = [];
let nearbyPage = 1;
let nearbyOrigin = null;
let nearbyMap = null;
let nearbyMarkersLayer = null;
let nearbySortMode = "distance";
let nearbyCreatedAfter = null;
let nearbyCreatedBefore = null;
const NEARBY_MIN_DATE = new Date("2024-01-01T00:00:00");
let currentIssue = null;
let nearbyMinDate = null;
let nearbyMaxDate = null;

const clampDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateShort = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const getIssueId = (issue) => {
  if (!issue) return null;
  return issue.id || issue.issue_id || issue.issueId || null;
};

const statusToClass = (status) => {
  if (!status) return "other";
  const key = status.toLowerCase();
  if (key.includes("open")) return "open";
  if (key.includes("ack")) return "acknowledged";
  if (key.includes("closed")) return "closed";
  if (key.includes("arch")) return "archived";
  return "other";
};

const buildIssueLink = (issue) => {
  const issueId = getIssueId(issue);
  if (!issueId) return null;
  return `issue.html?id=${encodeURIComponent(issueId)}`;
};

const addDetailRow = (list, label, value) => {
  if (value === null || value === undefined || value === "") return;
  const term = document.createElement("dt");
  term.textContent = label;
  const definition = document.createElement("dd");
  if (value instanceof HTMLElement) {
    definition.appendChild(value);
  } else {
    definition.textContent = value;
  }
  list.append(term, definition);
};

const getCleanMediaUrl = (value) => {
  if (!value) return "";
  if (value === "null") return "";
  return value;
};

const collectIssueImages = (issue) => {
  const media = issue?.media || {};
  const candidates = [
    media.image_full,
    // media.representative_image_url,
    // media.image_square_100x100,
    // media.image,
    issue?.image_full,
    issue?.image
  ]
    .map(getCleanMediaUrl)
    .filter(Boolean);
  return [...new Set(candidates)];
};

const renderIssueDetails = (issue) => {
  detailContainer.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = issue.summary || "Untitled issue";

  const description = document.createElement("p");
  description.textContent = issue.description || "No description provided.";

  const list = document.createElement("dl");

  addDetailRow(list, "Status", issue.status);
  addDetailRow(list, "Address", issue.address);
  addDetailRow(list, "Service Area", issue.service_area?.name);
  addDetailRow(list, "Reporter", issue.reporter?.name);
  addDetailRow(list, "Created", formatDate(issue.created_at));
  addDetailRow(list, "Updated", formatDate(issue.updated_at));
  addDetailRow(list, "Votes", issue.vote_count);
  addDetailRow(list, "Comments", issue.comment_count);
  addDetailRow(list, "Issue ID", issue.id || issue.issue_id);
  if (issue.lat && issue.lng) {
    addDetailRow(
      list,
      "Coordinates",
      `${Number(issue.lat).toFixed(5)}, ${Number(issue.lng).toFixed(5)}`
    );
  }

  if (issue.url) {
    const link = document.createElement("a");
    link.href = issue.url;
    link.className = "external-link";
    link.textContent = "View on SeeClickFix";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  if (Array.isArray(issue.tags) && issue.tags.length) {
    addDetailRow(list, "Tags", issue.tags.join(", "));
  }

  const imageUrls = collectIssueImages(issue);
  if (imageUrls.length) {
    const gallery = document.createElement("div");
    gallery.className = "issue-media-grid";
    imageUrls.forEach((url, index) => {
      const image = document.createElement("img");
      image.className = "issue-media-image";
      image.src = url;
      image.alt = issue.summary
        ? `${issue.summary} photo ${index + 1}`
        : `Issue photo ${index + 1}`;
      image.loading = "lazy";
      gallery.append(image);
    });
    addDetailRow(list, "Photos", gallery);
  }

  const videoUrl = getCleanMediaUrl(issue?.media?.video_url);
  if (videoUrl) {
    const videoLink = document.createElement("a");
    videoLink.href = videoUrl;
    videoLink.className = "external-link";
    videoLink.target = "_blank";
    videoLink.rel = "noopener noreferrer";
    videoLink.textContent = "View video attachment";
    addDetailRow(list, "Video", videoLink);
  }

  detailContainer.append(title, description, list);
  detailContainer.hidden = false;
};

const renderComments = (comments) => {
  commentsList.innerHTML = "";

  if (!Array.isArray(comments) || comments.length === 0) {
    commentsStatus.textContent = "No comments yet.";
    commentsList.hidden = true;
    return;
  }

  commentsStatus.textContent = "";
  commentsList.hidden = false;

  comments.forEach((comment) => {
    const item = document.createElement("li");
    item.className = "comment-item";

    const header = document.createElement("div");
    header.className = "comment-header";

    const author = document.createElement("span");
    const authorName =
      comment.commenter?.name ||
      comment.reporter?.name ||
      comment.user?.name ||
      "Anonymous";
    author.textContent = authorName;

    const role = comment.commenter?.role || comment.user?.role || "";
    if (role) {
      const roleTag = document.createElement("span");
      roleTag.className = "comment-role";
      roleTag.textContent = role;
      header.append(author, roleTag);
    } else {
      header.append(author);
    }

    const created = document.createElement("span");
    created.className = "comment-date";
    created.textContent =
      formatDate(comment.created_at) ||
      formatDate(comment.created_at?.date_time) ||
      "Unknown date";

    header.append(created);

    const body = document.createElement("p");
    body.className = "comment-body";
    body.textContent =
      comment.comment ||
      comment.body ||
      comment.text ||
      comment.description ||
      "No comment text provided.";

    item.append(header, body);

    const media = comment.media || {};
    const imageUrl =
      media.image_full ||
      media.image ||
      comment.image_full ||
      comment.image ||
      "";
    const cleanImageUrl = imageUrl && imageUrl !== "null" ? imageUrl : "";
    if (cleanImageUrl) {
      const image = document.createElement("img");
      image.className = "comment-image";
      image.src = cleanImageUrl;
      image.alt = `Comment image from ${authorName}`;
      image.loading = "lazy";
      item.append(image);
    }

    const videoUrlRaw = media.video_url || comment.video_url || "";
    const videoUrl = videoUrlRaw && videoUrlRaw !== "null" ? videoUrlRaw : "";
    if (videoUrl) {
      const videoLink = document.createElement("a");
      videoLink.href = videoUrl;
      videoLink.className = "comment-media-link";
      videoLink.target = "_blank";
      videoLink.rel = "noopener noreferrer";
      videoLink.textContent = "View video attachment";
      item.append(videoLink);
    }

    commentsList.append(item);
  });
};

const loadComments = async (issueId) => {
  if (!commentsStatus || !commentsList) return;

  commentsStatus.textContent = "Loading comments...";
  commentsList.hidden = true;

  const url = `https://seeclickfix.com/api/v2/issues/${encodeURIComponent(
    issueId
  )}/comments`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to load comments.");
    }
    const data = await response.json();
    const comments = data.comments || data;
    renderComments(comments);
  } catch (error) {
    commentsStatus.textContent = error.message;
    commentsList.hidden = true;
  }
};

const buildBoundingBox = (coords, radiusFeet) => {
  const radiusMiles = radiusFeet / 5280;
  const milesPerDegreeLat = 69;
  const milesPerDegreeLng = 69 * Math.cos((coords.lat * Math.PI) / 180);

  const latDelta = radiusMiles / milesPerDegreeLat;
  const lngDelta = radiusMiles / milesPerDegreeLng;

  return {
    min_lat: coords.lat - latDelta,
    min_lng: coords.lng - lngDelta,
    max_lat: coords.lat + latDelta,
    max_lng: coords.lng + lngDelta
  };
};

const getDistanceFeet = (lat1, lng1, lat2, lng2) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c * 5280;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const addDays = (date, days) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

const updateBetweenLabel = () => {
  if (!nearbyCreatedLabel) return;
  if (!nearbyCreatedAfter || !nearbyCreatedBefore) {
    nearbyCreatedLabel.textContent = "—";
    return;
  }
  const endInclusive = addDays(nearbyCreatedBefore, -1);
  nearbyCreatedLabel.textContent = `${formatDateShort(
    nearbyCreatedAfter
  )} – ${formatDateShort(endInclusive)}`;
};

const applyBetweenDates = (startDate, endDate) => {
  if (!startDate || !endDate) return;
  let normalizedStart = startDate;
  let normalizedEnd = endDate;
  if (normalizedStart > normalizedEnd) {
    const tmp = normalizedStart;
    normalizedStart = normalizedEnd;
    normalizedEnd = tmp;
  }
  nearbyCreatedAfter = normalizedStart;
  nearbyCreatedBefore = addDays(normalizedEnd, 1);
  updateBetweenLabel();
  nearbyPage = 1;
  renderNearbyIssuesPage();
};

const getSortedNearbyIssues = () => {
  const filtered = nearbyIssues.filter((issue) => {
    const createdAt = new Date(issue.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;
    if (nearbyCreatedAfter && createdAt < nearbyCreatedAfter) return false;
    if (nearbyCreatedBefore && createdAt >= nearbyCreatedBefore) return false;
    return true;
  });
  if (nearbySortMode === "distance") {
    return filtered.sort((a, b) => {
      const aDistance = Number.isFinite(a.distance_feet)
        ? a.distance_feet
        : Number.POSITIVE_INFINITY;
      const bDistance = Number.isFinite(b.distance_feet)
        ? b.distance_feet
        : Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });
  }

  return filtered.sort((a, b) => {
    const aTime = new Date(a.created_at).getTime() || 0;
    const bTime = new Date(b.created_at).getTime() || 0;
    return bTime - aTime;
  });
};

const ensureNearbyMap = (origin) => {
  if (!nearbyMapElement || typeof L === "undefined") return;
  if (!nearbyMap) {
    nearbyMap = L.map("nearby-map").setView([origin.lat, origin.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(nearbyMap);
    nearbyMarkersLayer = L.layerGroup().addTo(nearbyMap);
  }
};

const renderNearbyMapMarkers = (issues) => {
  if (!nearbyMap || !nearbyMarkersLayer || !nearbyOrigin) return;

  nearbyMarkersLayer.clearLayers();

  L.circleMarker([nearbyOrigin.lat, nearbyOrigin.lng], {
    radius: 8,
    color: "#b42318",
    fillColor: "#e23d28",
    fillOpacity: 0.95,
    weight: 2
  })
    .addTo(nearbyMarkersLayer)
    .bindPopup("Current issue");

  issues.forEach((issue) => {
    if (!issue.lat || !issue.lng) return;
    L.circleMarker([issue.lat, issue.lng], {
      radius: 6,
      color: "#c89b2b",
      fillColor: "#f4c542",
      fillOpacity: 0.9,
      weight: 1
    })
      .addTo(nearbyMarkersLayer)
      .bindPopup(issue.summary || "Nearby issue");
  });

  const bounds = L.latLngBounds(
    [nearbyOrigin.lat, nearbyOrigin.lng],
    ...issues
      .filter((issue) => issue.lat && issue.lng)
      .map((issue) => [Number(issue.lat), Number(issue.lng)])
  );
  if (bounds.isValid()) {
    nearbyMap.fitBounds(bounds.pad(0.2));
  }
};

const renderNearbyIssuesPage = () => {
  if (!nearbyList || !nearbyStatus) return;

  nearbyList.innerHTML = "";

  if (!nearbyIssues.length) {
    nearbyStatus.textContent = `No nearby issues found within ${NEARBY_RADIUS_FEET} feet.`;
    nearbyList.hidden = true;
    if (nearbyPagination) nearbyPagination.hidden = true;
    if (nearbyOrigin) {
      ensureNearbyMap(nearbyOrigin);
      renderNearbyMapMarkers([]);
    }
    return;
  }

  const sortedIssues = getSortedNearbyIssues();
  const totalPages = Math.ceil(sortedIssues.length / NEARBY_PAGE_SIZE);
  nearbyPage = Math.min(Math.max(nearbyPage, 1), totalPages);

  const startIndex = (nearbyPage - 1) * NEARBY_PAGE_SIZE;
  const pageItems = sortedIssues.slice(
    startIndex,
    startIndex + NEARBY_PAGE_SIZE
  );

  pageItems.forEach((issue) => {
    const item = document.createElement("li");
    const statusClass = statusToClass(issue.status);
    item.className = `nearby-item ${statusClass}`;

    const title = document.createElement("h3");
    const issueLink = buildIssueLink(issue);
    if (issueLink) {
      const link = document.createElement("a");
      link.href = issueLink;
      link.className = "issue-title-link";
      link.textContent = issue.summary || "Untitled issue";
      title.appendChild(link);
    } else {
      title.textContent = issue.summary || "Untitled issue";
    }

    const status = document.createElement("p");
    status.textContent = `Status: ${issue.status || "Unknown"}`;

    const address = document.createElement("p");
    address.textContent = issue.address || "Address unavailable";

    const meta = document.createElement("p");
    meta.className = "meta";
    const createdAt =
      formatDate(issue.created_at) ||
      formatDate(issue.created_at?.date_time) ||
      "Unknown date";
    const distance = Number.isFinite(issue.distance_feet)
      ? `${issue.distance_feet.toFixed(0)} ft away`
      : null;
    meta.textContent = distance
      ? `Created: ${createdAt} \u00b7 ${distance}`
      : `Created: ${createdAt}`;

    item.append(title, status, address, meta);
    nearbyList.appendChild(item);
  });

  nearbyStatus.textContent = "";
  nearbyList.hidden = false;

  if (nearbyPagination && nearbyPageLabel) {
    nearbyPagination.hidden = totalPages <= 1;
    nearbyPageLabel.textContent = `Page ${nearbyPage} of ${totalPages}`;
    if (nearbyPrevButton) {
      nearbyPrevButton.disabled = nearbyPage <= 1;
    }
    if (nearbyNextButton) {
      nearbyNextButton.disabled = nearbyPage >= totalPages;
    }
  }

  renderNearbyMapMarkers(pageItems);
};

const loadNearbyIssues = async (issue) => {
  if (!nearbyStatus || !nearbyList) return;

  const lat = Number(issue.lat);
  const lng = Number(issue.lng);
  const issueId = getIssueId(issue);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    nearbyStatus.textContent = "Location unavailable for nearby issues.";
    nearbyList.hidden = true;
    if (nearbyPagination) nearbyPagination.hidden = true;
    return;
  }

  nearbyOrigin = { lat, lng };
  nearbyStatus.textContent = "Loading nearby issues...";
  nearbyList.hidden = true;
  if (nearbyPagination) nearbyPagination.hidden = true;

  const bbox = buildBoundingBox(nearbyOrigin, NEARBY_RADIUS_FEET);
  const params = new URLSearchParams({
    min_lat: bbox.min_lat,
    min_lng: bbox.min_lng,
    max_lat: bbox.max_lat,
    max_lng: bbox.max_lng,
    status: ALL_STATUSES,
    sort: "created_at",
    sort_direction: "desc",
    per_page: 100
  });
  const afterValue = nearbyCreatedAfter || NEARBY_MIN_DATE;
  params.set("after", afterValue.toISOString());
  if (nearbyCreatedBefore) {
    params.set("before", nearbyCreatedBefore.toISOString());
  }

  const url = `https://seeclickfix.com/api/v2/issues?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to load nearby issues.");
    }
    const data = await response.json();
    const issues = data.issues || [];

    nearbyIssues = issues
      .filter((nearby) => {
        const nearId = getIssueId(nearby);
        if (issueId && nearId && `${nearId}` === `${issueId}`) return false;
        if (!nearby.lat || !nearby.lng) return false;
        const distance = getDistanceFeet(
          nearbyOrigin.lat,
          nearbyOrigin.lng,
          Number(nearby.lat),
          Number(nearby.lng)
        );
        if (Number.isNaN(distance)) return false;
        nearby.distance_feet = distance;
        return distance <= NEARBY_RADIUS_FEET;
      });

    nearbyPage = 1;
    ensureNearbyMap(nearbyOrigin);
    renderNearbyIssuesPage();
  } catch (error) {
    nearbyStatus.textContent = error.message;
    nearbyList.hidden = true;
    if (nearbyPagination) nearbyPagination.hidden = true;
  }
};

const loadIssue = async () => {
  const params = new URLSearchParams(window.location.search);
  const issueId = params.get("id");

  if (!issueId) {
    statusMessage.textContent = "No issue id provided.";
    return;
  }

  const url = `https://seeclickfix.com/api/v2/issues/${encodeURIComponent(
    issueId
  )}?details=true`;

  statusMessage.textContent = "Loading issue...";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to load issue details.");
    }
    const data = await response.json();
    const issue = data.issue || data;
    if (!issue || typeof issue !== "object") {
      throw new Error("Issue details are unavailable.");
    }
    currentIssue = issue;
    statusMessage.textContent = "";
    renderIssueDetails(issue);
    loadComments(issueId);
    if (nearbyCreatedStart && nearbyCreatedEnd) {
      const issueDate = new Date(issue.created_at);
      if (!Number.isNaN(issueDate.getTime())) {
        const minDate = nearbyMinDate || NEARBY_MIN_DATE;
        const maxDate = nearbyMaxDate || new Date();
        let defaultEnd = issueDate;
        if (defaultEnd < minDate) defaultEnd = minDate;
        if (defaultEnd > maxDate) defaultEnd = maxDate;
        let defaultStart = addDays(defaultEnd, -30) || minDate;
        if (defaultStart < minDate) defaultStart = minDate;
        if (defaultStart > defaultEnd) defaultStart = defaultEnd;
        nearbyCreatedStart.value = formatDateInput(defaultStart);
        nearbyCreatedEnd.value = formatDateInput(defaultEnd);
        applyBetweenDates(defaultStart, defaultEnd);
      }
    }
    loadNearbyIssues(issue);
  } catch (error) {
    statusMessage.textContent = error.message;
  }
};

if (nearbyPrevButton) {
  nearbyPrevButton.addEventListener("click", () => {
    nearbyPage = Math.max(1, nearbyPage - 1);
    renderNearbyIssuesPage();
  });
}

if (nearbyNextButton) {
  nearbyNextButton.addEventListener("click", () => {
    nearbyPage += 1;
    renderNearbyIssuesPage();
  });
}

if (nearbySortSelect) {
  nearbySortSelect.addEventListener("change", (event) => {
    nearbySortMode = event.target.value;
    nearbyPage = 1;
    renderNearbyIssuesPage();
  });
}

if (nearbyCreatedStart && nearbyCreatedEnd && nearbyCreatedLabel) {
  const today = new Date();
  const minDate = clampDate(NEARBY_MIN_DATE) || today;
  const maxDate = clampDate(today) || today;
  nearbyMinDate = minDate;
  nearbyMaxDate = maxDate;

  nearbyCreatedStart.min = formatDateInput(minDate);
  nearbyCreatedStart.max = formatDateInput(maxDate);
  nearbyCreatedStart.value = formatDateInput(minDate);

  nearbyCreatedEnd.min = formatDateInput(minDate);
  nearbyCreatedEnd.max = formatDateInput(maxDate);
  nearbyCreatedEnd.value = formatDateInput(maxDate);

  applyBetweenDates(minDate, maxDate);

  const handleDateInput = () => {
    const startDate = parseDateInput(nearbyCreatedStart.value);
    const endDate = parseDateInput(nearbyCreatedEnd.value);
    if (startDate && endDate && startDate > endDate) {
      if (document.activeElement === nearbyCreatedStart) {
        nearbyCreatedEnd.value = nearbyCreatedStart.value;
      } else {
        nearbyCreatedStart.value = nearbyCreatedEnd.value;
      }
    }
    applyBetweenDates(
      parseDateInput(nearbyCreatedStart.value),
      parseDateInput(nearbyCreatedEnd.value)
    );
    if (currentIssue) {
      loadNearbyIssues(currentIssue);
    }
  };

  nearbyCreatedStart.addEventListener("change", handleDateInput);
  nearbyCreatedEnd.addEventListener("change", handleDateInput);
}

loadIssue();
