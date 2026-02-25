#!/usr/bin/env luajit
-- Claude Code Status Line Script (Lua)
-- Displays: Parent/Current Dir | Model | Git Branch | Context Usage

-- Minimal JSON decoder
local function json_decode(str)
  local pos = 1

  local function skip_ws()
    pos = str:find("[^ \t\n\r]", pos) or pos
  end

  local function parse_string()
    pos = pos + 1
    local parts = {}
    while pos <= #str do
      local c = str:sub(pos, pos)
      if c == '"' then
        pos = pos + 1
        return table.concat(parts)
      elseif c == '\\' then
        pos = pos + 1
        local esc = str:sub(pos, pos)
        if esc == 'n' then parts[#parts + 1] = '\n'
        elseif esc == 't' then parts[#parts + 1] = '\t'
        elseif esc == 'r' then parts[#parts + 1] = '\r'
        elseif esc == 'u' then pos = pos + 4; parts[#parts + 1] = '?'
        else parts[#parts + 1] = esc
        end
      else
        parts[#parts + 1] = c
      end
      pos = pos + 1
    end
  end

  local parse_value

  local function parse_object()
    pos = pos + 1
    local obj = {}
    skip_ws()
    if str:sub(pos, pos) == '}' then pos = pos + 1; return obj end
    while true do
      skip_ws()
      local key = parse_string()
      skip_ws()
      pos = pos + 1 -- skip :
      skip_ws()
      obj[key] = parse_value()
      skip_ws()
      if str:sub(pos, pos) == ',' then pos = pos + 1 else break end
    end
    skip_ws()
    pos = pos + 1
    return obj
  end

  local function parse_array()
    pos = pos + 1
    local arr = {}
    skip_ws()
    if str:sub(pos, pos) == ']' then pos = pos + 1; return arr end
    while true do
      skip_ws()
      arr[#arr + 1] = parse_value()
      skip_ws()
      if str:sub(pos, pos) == ',' then pos = pos + 1 else break end
    end
    skip_ws()
    pos = pos + 1
    return arr
  end

  local function parse_number()
    local s = pos
    if str:sub(pos, pos) == '-' then pos = pos + 1 end
    while str:sub(pos, pos):match('[0-9]') do pos = pos + 1 end
    if str:sub(pos, pos) == '.' then
      pos = pos + 1
      while str:sub(pos, pos):match('[0-9]') do pos = pos + 1 end
    end
    if str:sub(pos, pos):match('[eE]') then
      pos = pos + 1
      if str:sub(pos, pos):match('[+-]') then pos = pos + 1 end
      while str:sub(pos, pos):match('[0-9]') do pos = pos + 1 end
    end
    return tonumber(str:sub(s, pos - 1))
  end

  parse_value = function()
    skip_ws()
    local c = str:sub(pos, pos)
    if c == '"' then return parse_string()
    elseif c == '{' then return parse_object()
    elseif c == '[' then return parse_array()
    elseif c == 't' then pos = pos + 4; return true
    elseif c == 'f' then pos = pos + 5; return false
    elseif c == 'n' then pos = pos + 4; return nil
    else return parse_number()
    end
  end

  return parse_value()
end

-- Shell-safe quoting
local function shell_quote(s)
  return "'" .. s:gsub("'", "'\\''") .. "'"
end

-- Run a shell command and return trimmed output
local function exec(cmd)
  local h = io.popen(cmd)
  local out = h:read("*a")
  h:close()
  return out and out:gsub("%s+$", "") or ""
end

-- Read stdin and parse JSON
local input = io.read("*a")
local ok, data = pcall(json_decode, input)
if not ok or type(data) ~= "table" then
  io.write(" \u{1f9e0} [Claude]\n")
  return
end

-- Extract values
local model = (data.model and data.model.display_name) or "Claude"
local current_dir = (data.workspace and data.workspace.current_dir) or ""

-- Context window: use pre-calculated used_percentage (nil when no messages yet)
local ctx = data.context_window or {}
local used_pct_raw = ctx.used_percentage  -- may be nil/null before first message
local used_pct = used_pct_raw and math.floor(used_pct_raw + 0.5) or nil

-- Directory info: parent/current
local dir_info = ""
if current_dir ~= "" then
  local current_name = current_dir:match("([^/]+)$") or current_dir
  local parent_path = current_dir:match("(.+)/[^/]+$") or "/"
  local parent_name = parent_path:match("([^/]+)$")
  if parent_name then
    dir_info = parent_name .. "/" .. current_name
  else
    dir_info = "/" .. current_name
  end
end

-- Git branch + dirty status
local git_info = ""
if current_dir ~= "" then
  local qdir = shell_quote(current_dir)
  local git_dir = exec("cd " .. qdir .. " 2>/dev/null && git -c gc.auto=0 rev-parse --git-dir 2>/dev/null")
  if git_dir ~= "" then
    local branch = exec("cd " .. qdir .. " && git -c gc.auto=0 branch --show-current 2>/dev/null")
    if branch ~= "" then
      local status = exec("cd " .. qdir .. " && git -c gc.auto=0 status --porcelain 2>/dev/null")
      if status ~= "" then
        git_info = " | \u{1f342}  " .. branch .. "*"
      else
        git_info = " | \u{1f342} " .. branch
      end
    end
  end
end

-- Context progress bar with ANSI colors (only when data is available)
local GREEN, YELLOW, RED, RESET = "\027[32m", "\027[33m", "\027[31m", "\027[0m"
local ctx_info = ""
if used_pct ~= nil then
  local bar_color = used_pct >= 90 and RED or used_pct >= 70 and YELLOW or GREEN
  local bar_width = 10
  local filled = math.floor(used_pct * bar_width / 100)
  local bar = bar_color .. string.rep("\u{2593}", filled) .. string.rep("\u{2591}", bar_width - filled) .. RESET
  ctx_info = string.format(" |  %s %d%%", bar, used_pct)
else
  ctx_info = " | \u{2591}\u{2591}\u{2591}\u{2591}\u{2591}\u{2591}\u{2591}\u{2591}\u{2591}\u{2591} --%"
end

-- Output status line
if dir_info ~= "" then
  io.write(string.format(" \u{1f4c1} %s | \u{1f9e0} [%s]%s%s\n",
    dir_info, model, git_info, ctx_info))
else
  io.write(string.format(" \u{1f9e0} [%s]%s%s\n",
    model, git_info, ctx_info))
end
