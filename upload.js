document.addEventListener("DOMContentLoaded", function () {
    const postText = document.getElementById("postText");
    const postFile = document.getElementById("postFile");
    const previewContainer = document.getElementById("previewContainer");
    const postButton = document.getElementById("postButton");
    const tagCheckboxes = document.querySelectorAll(".tag-checkbox");

    // Lightbox for fullscreen view
    const lightbox = document.createElement("div");
    lightbox.id = "lightbox";
    lightbox.innerHTML = `<span class="close">&times;</span><div id="lightbox-content"></div>`;
    document.body.appendChild(lightbox);
    const lightboxContent = document.getElementById("lightbox-content");

    lightbox.addEventListener("click", () => {
        lightbox.style.display = "none";
    });

    // Store selected tags
    let selectedTags = [];

    tagCheckboxes.forEach(tag => {
        tag.addEventListener("change", function () {
            selectedTags = Array.from(tagCheckboxes)
                .filter(t => t.checked)
                .map(t => t.value);
        });
    });

    // IndexedDB Setup
    let db;
    const request = indexedDB.open("PostDB", 1);

    request.onupgradeneeded = function (event) {
        let db = event.target.result;
        if (!db.objectStoreNames.contains("posts")) {
            db.createObjectStore("posts", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        loadPosts();
    };

    request.onerror = function (event) {
        console.error("IndexedDB error:", event.target.errorCode);
    };

    // Preview uploaded media
    postFile.addEventListener("change", function () {
        previewContainer.innerHTML = "";
        previewContainer.classList.remove("d-none");

        const files = postFile.files;
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const previewItem = document.createElement("div");
                    previewItem.classList.add("col-4", "p-1");

                    if (file.type.startsWith("image")) {
                        previewItem.innerHTML = `<img src="${e.target.result}" class="img-fluid rounded">`;
                    } else if (file.type.startsWith("video")) {
                        previewItem.innerHTML = `<video src="${e.target.result}" class="img-fluid rounded" controls></video>`;
                    }

                    previewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
        }
    });

    

    // Post button functionality
    postButton.addEventListener("click", function () {
        const text = postText.value.trim();
        const files = postFile.files;

        if (text === "" && files.length === 0) {
            alert("Please enter some text or upload at least one file.");
            return;
        }

        const post = {
            text,
            tags: selectedTags,
            date: new Date().toLocaleString(),
            media: []
        };

        // Read files as data URLs
        const filePromises = Array.from(files).map(file => {
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve({ type: file.type, data: reader.result });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(filePromises).then(mediaFiles => {
            post.media = mediaFiles;
            savePost(post);
            displayPost(post);
        });

        // Reset fields
        postText.value = "";
        postFile.value = "";
        previewContainer.innerHTML = "";
        previewContainer.classList.add("d-none");
        selectedTags = [];
        tagCheckboxes.forEach(tag => tag.checked = false);

        let modal = bootstrap.Modal.getInstance(document.getElementById("postModal"));
        modal.hide();
    });

    // Save post to IndexedDB
    function savePost(post) {
        const transaction = db.transaction(["posts"], "readwrite");
        const store = transaction.objectStore("posts");
        store.add(post);
    }

    // Delete post from IndexedDB
    function deletePost(id) {
        const transaction = db.transaction(["posts"], "readwrite");
        const store = transaction.objectStore("posts");
        const request = store.delete(id);

        request.onsuccess = function (event) {
            console.log("Post deleted with ID:", id);
        };
    }

    // Load posts from IndexedDB on page load
    function loadPosts() {
        const transaction = db.transaction(["posts"], "readonly");
        const store = transaction.objectStore("posts");
        const request = store.getAll();

        request.onsuccess = function (event) {
            const posts = event.target.result;
            posts.forEach(displayPost);
        };
    }

    // Display a post
    function displayPost(post) {
        const postContainer = document.createElement("div");
        postContainer.classList.add("post-container");

        if (post.text) {
            const textElement = document.createElement("p");
            textElement.classList.add("fw-bold", "mb-2");
            textElement.textContent = post.text;
            postContainer.appendChild(textElement);
        }

        if (post.media.length > 0) {
            // Add line before media
            const lineElement = document.createElement("hr");
            postContainer.appendChild(lineElement);

            const mediaContainer = document.createElement("div");
            mediaContainer.classList.add("media-container");

            post.media.forEach(media => {
                const mediaItem = document.createElement("div");
                if (media.type.startsWith("image")) {
                    mediaItem.innerHTML = `<img src="${media.data}" class="lightbox-trigger">`;
                } else if (media.type.startsWith("video")) {
                    mediaItem.innerHTML = `<video src="${media.data}" class="lightbox-trigger" controls></video>`;
                }
                mediaContainer.appendChild(mediaItem);
            });

            postContainer.appendChild(mediaContainer);
        }

        // Add line before date
        const lineElement = document.createElement("hr");
        postContainer.appendChild(lineElement);

        // Create tag container
        if (post.tags.length > 0) {
            const tagContainer = document.createElement("p");
            tagContainer.classList.add("small", "fw-bold", "mt-2");
            tagContainer.textContent = `Tags: ${post.tags.join(", ")}`;
            postContainer.appendChild(tagContainer);
        }

        // Create date element
        const dateElement = document.createElement("p");
        dateElement.textContent = `${post.date}`;
        dateElement.classList.add("text-muted", "small", "mt-2");
        postContainer.appendChild(dateElement);

        // Add delete button
        const deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-outline-danger", "float-end");
        deleteButton.textContent = "Delete";

        deleteButton.style.marginTop = "-70px"; // Moves it up by 6px

        deleteButton.addEventListener("click", () => {
            deletePost(post.id);
            postContainer.remove();
        });
        postContainer.appendChild(deleteButton);

        // Add new post at the top
        const existingPosts = document.querySelectorAll(".post-container");
        if (existingPosts.length > 0) {
            const firstPost = existingPosts[0];
            firstPost.parentElement.insertBefore(postContainer, firstPost);
        } else {
            document.body.appendChild(postContainer);
        }

        attachLightboxTriggers();
    }

    // Attach Lightbox Triggers to New Elements
    function attachLightboxTriggers() {
        document.querySelectorAll(".lightbox-trigger").forEach(element => {
            element.addEventListener("click", function () {
                lightboxContent.innerHTML = this.outerHTML;
                lightbox.style.display = "flex";
            });
        });
    }

    attachLightboxTriggers(); // Initial call to attach lightbox functionality
});

