export const SearchBar = {
  props: {
    modelValue: { type: String, required: true },
    placeholder: { type: String, default: "Søg..." },
    buttonLabel: { type: String, default: "Søg" }
  },
  emits: ["update:modelValue", "submit"],
  template: `
    <form class="search-wrap" @submit.prevent="$emit('submit')">
      <input
        type="text"
        :value="modelValue"
        :placeholder="placeholder"
        class="search-input"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button type="submit">{{ buttonLabel }}</button>
    </form>
  `
};
