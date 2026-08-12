/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* Cloudflare Worker URL for the L'Oréal routine builder.
   Replace the placeholder below with the class worker URL from the README.
   Do not add an OpenAI API key to this browser code. */
const WORKER_URL = "https://loreal-routine.your-subdomain.workers.dev/";

let allProducts = [];
let currentDisplayProducts = [];
const selectedProductIds = new Set();
const messages = [
  {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. Build personalized routines and answer follow-up questions using selected products.",
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

selectedProductsList.innerHTML = `<span>No products selected yet.</span>`;

/* Load product data from JSON file once */
async function getProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentDisplayProducts = products;

  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for that category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProductIds.has(product.id) ? "selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Show selected products below the product list */
function renderSelectedProducts() {
  if (selectedProductIds.size === 0) {
    selectedProductsList.innerHTML = `<span>No products selected yet.</span>`;
    return;
  }

  selectedProductsList.innerHTML = Array.from(selectedProductIds)
    .map((productId) => {
      const product = allProducts.find((item) => item.id === productId);
      return `<span data-product-id="${productId}">${product.name}</span>`;
    })
    .join("");
}

/* Add or remove a selected product */
function toggleSelectedProduct(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  renderSelectedProducts();
  displayProducts(currentDisplayProducts);
}

/* Append chat messages to the chat window */
function appendChatMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.className = role === "user" ? "chat-user" : "chat-assistant";
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send the messages array to the Cloudflare Worker */
async function sendToOpenAI(messagesToSend) {
  try {
    sendBtn.disabled = true;
    generateRoutineBtn.disabled = true;

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: messagesToSend }),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed (${response.status})`);
    }

    const data = await response.json();
    const assistantMessage =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't get a response from the AI service.";

    messages.push({ role: "assistant", content: assistantMessage });
    appendChatMessage("assistant", assistantMessage);
  } catch (error) {
    appendChatMessage(
      "assistant",
      "There was a problem connecting to the AI service. Please check the Worker URL and try again.",
    );
    console.error("OpenAI connection error:", error);
  } finally {
    sendBtn.disabled = false;
    generateRoutineBtn.disabled = false;
  }
}

/* Convert selected products into a text summary for the AI prompt */
function getSelectedProductsSummary() {
  const selectedProducts = Array.from(selectedProductIds)
    .map((id) => allProducts.find((product) => product.id === id))
    .filter(Boolean);

  if (!selectedProducts.length) {
    return "";
  }

  return selectedProducts
    .map(
      (product, index) =>
        `${index + 1}. ${product.name} by ${product.brand}\n   ${product.description}`,
    )
    .join("\n\n");
}

/* Create a routine request using the selected products */
async function generateRoutine() {
  if (selectedProductIds.size === 0) {
    appendChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const summary = getSelectedProductsSummary();
  const routineRequest = `Build a personalized routine using these selected products:\n\n${summary}\n\nExplain the order, how to use each product, and any timing advice.`;

  appendChatMessage("user", "Generate a routine using the selected products.");
  messages.push({ role: "user", content: routineRequest });

  await sendToOpenAI(messages);
}

/* Handle the category filter changing */
categoryFilter.addEventListener("change", async (e) => {
  const products = await getProducts();
  const selectedCategory = e.target.value;

  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Handle product card clicks for selection */
productsContainer.addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) {
    return;
  }

  const productId = Number(card.dataset.productId);
  toggleSelectedProduct(productId);
});

/* Handle routine generation button */
generateRoutineBtn.addEventListener("click", async () => {
  await generateRoutine();
});

/* Handle chat form submission for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  appendChatMessage("user", userText);
  messages.push({ role: "user", content: userText });
  userInput.value = "";

  await sendToOpenAI(messages);
});

/* Preload product data */
(async function init() {
  await getProducts();
})();
