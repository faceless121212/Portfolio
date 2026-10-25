// Mobile nav toggle + reduced-motion handling for the hero video. No dependencies.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
    });
  }

  // With prefers-reduced-motion, swap the video for its poster image.
  var video = document.querySelector(".hero-media video");
  if (video && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var img = document.createElement("img");
    img.src = video.getAttribute("poster");
    img.alt = video.getAttribute("aria-label") || "";
    video.replaceWith(img);
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
