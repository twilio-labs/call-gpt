// create metadata for all the available functions to pass to completions API
const tools = [
  {
    type: "function",
    function: {
      name: "checkInventory",
      description: "Check the inventory of airpods, airpods pro or airpods max.",
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            "enum": ["airpods", "airpods pro", "airpods max"],
            description: "The model of airpods, either the airpods, airpods pro or airpods max",
          },
        },
        required: ["model"],
      },
      returns: {
        type: "object",
        properties: {
          stock: {
            type: "integer",
            description: "An integer containing how many of the model are in currently in stock."
          }
        }
      }
    },
  },
  {
    type: "function",
    function: {
      name: "checkPrice",
      description: "Check the price of given model of airpods, airpods pro or airpods max.",
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            "enum": ["airpods", "airpods pro", "airpods max"],
            description: "The model of airpods, either the airpods, airpods pro or airpods max",
          },
        },
        required: ["model"],
      },
      returns: {
        type: "object",
        properties: {
          price: {
            type: "integer",
            description: "the price of the model"
          }
        }
      }
    },
  },
  {
    type: "function",
    function: {
      name: "placeOrder",
      description: "Places an order for a set of airpods.",
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            "enum": ["airpods", "airpods pro"],
            description: "The model of airpods, either the regular or pro",
          },
          quantity: {
            type: "integer",
            description: "The number of airpods they want to order",
          },
        },
        required: ["type", "quantity"],
      },
      returns: {
        type: "object",
        properties: {
          price: {
            type: "integer",
            description: "The total price of the order including tax"
          },
          orderNumber: {
            type: "integer",
            description: "The order number associated with the order."
          }
        }
      }
    },
  },
];

module.exports = tools;