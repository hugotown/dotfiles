-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

local function save_file()
  local path = vim.api.nvim_buf_get_name(0)
  if path == "" or vim.bo.buftype ~= "" then
    vim.notify("No file to save", vim.log.levels.WARN)
    return
  end

  local ok, err = pcall(vim.cmd, "silent update")
  if ok then
    vim.notify(vim.fn.fnamemodify(path, ":t") .. " saved")
  else
    vim.notify(tostring(err), vim.log.levels.ERROR)
  end
end

vim.keymap.set("n", "<C-s>", save_file, { desc = "Save file" })
vim.keymap.set({ "i", "x", "s" }, "<C-c>", "<Esc>", { desc = "Normal mode" })
vim.keymap.set("t", "<C-c>", "<C-\\><C-n>", { desc = "Normal mode" })

vim.keymap.set("n", "<leader>bq", function()
  Snacks.bufdelete.other()
end, { desc = "Delete other buffers" })

vim.keymap.set("x", "<leader>sg", LazyVim.pick("grep_visual"), { desc = "Grep selection (root dir)" })

vim.keymap.set("n", "<leader>md", function()
  vim.cmd("delmarks!")
  vim.cmd("delmarks A-Z0-9")
  vim.notify("All marks deleted")
end, { desc = "Delete all marks" })
