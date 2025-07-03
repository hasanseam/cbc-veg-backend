const Joi = require('joi');

const productSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  price: Joi.number().positive().precision(2).required(),
  stock: Joi.number().integer().min(0).default(0),
  unit: Joi.string().max(50).default('kg'),
  used: Joi.number().integer().min(0).default(0),
  need_to_order: Joi.number().integer().min(0).default(0),
  description: Joi.string().allow('', null),
  image_url: Joi.string().uri().allow('', null),
  category: Joi.string().max(100).allow('', null),
  is_available: Joi.boolean().default(true)
});

const orderSchema = Joi.object({
  customer_name: Joi.string().min(1).max(255).required(),
  customer_email: Joi.string().email().allow('', null),
  customer_phone: Joi.string().max(50).allow('', null),
  customer_address: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required(),
      product_name: Joi.string().min(1).max(255).required(),
      quantity: Joi.number().positive().required(),
      unit: Joi.string().max(50).required(),
      price: Joi.number().positive().precision(2).required()
    })
  ).min(1).required()
});

const orderStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled').required()
});

module.exports = {
  productSchema,
  orderSchema,
  orderStatusSchema
};
