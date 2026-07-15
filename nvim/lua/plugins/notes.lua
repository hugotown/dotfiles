local vault = vim.fn.expand("~/.config/obsidian")

return {
  {
    "obsidian-nvim/obsidian.nvim",
    version = "*",
    cmd = "Obsidian",
    ft = "markdown",
    keys = {
      { "<leader>oc", "<cmd>Obsidian check<cr>", desc = "Check vault" },
      { "<leader>ot", "<cmd>Obsidian template<cr>", desc = "Insert template" },
      { "<leader>oo", "<cmd>Obsidian open<cr>", desc = "Open in Obsidian" },
      { "<leader>ob", "<cmd>Obsidian backlinks<cr>", desc = "Backlinks" },
      { "<leader>ol", "<cmd>Obsidian links<cr>", desc = "Links" },
      { "<leader>on", "<cmd>Obsidian new<cr>", desc = "New note" },
      { "<leader>os", "<cmd>Obsidian search<cr>", desc = "Search notes" },
      { "<leader>oq", "<cmd>Obsidian quick_switch<cr>", desc = "Quick switch" },
      { "<leader>od", "<cmd>Obsidian today<cr>", desc = "Daily note" },
      { "<leader>ox", "<cmd>Obsidian toggle_checkbox<cr>", desc = "Toggle checkbox" },
    },
    opts = {
      legacy_commands = false,
      workspaces = {
        {
          name = "notes",
          path = vault,
        },
      },
      picker = {
        name = "fzf-lua",
      },
      templates = {
        folder = "templates",
        date_format = "YYYY-MM-DD",
        time_format = "HH:mm",
      },
      callbacks = {
        enter_note = function(note)
          if not note then
            return
          end
          vim.keymap.set("n", "<CR>", function()
            return require("obsidian").util.smart_action()
          end, { buffer = note.bufnr, expr = true, desc = "Obsidian smart action" })
        end,
      },
    },
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    optional = true,
    opts = {
      heading = {
        icons = { "󰎤 ", "󰎧 ", "󰎪 ", "󰎭 ", "󰎱 ", "󰎳 " },
      },
      checkbox = {
        enabled = true,
        unchecked = { icon = "󰄱 " },
        checked = { icon = "󰱒 " },
        custom = {
          todo = { raw = "[-]", rendered = "󰥔 " },
        },
      },
    },
  },
  {
    "folke/which-key.nvim",
    optional = true,
    opts = {
      spec = {
        { "<leader>o", group = "Obsidian" },
      },
    },
  },
}
