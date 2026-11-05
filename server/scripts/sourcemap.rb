# Asciidoctor extension for the preview scroll sync.
#
# Adds the role `srcline-<n>` to every block of the main document, where <n>
# is the 1-based source line the block starts on. The preview page uses it to
# scroll to the rendered position of a source line.
require 'asciidoctor/extensions'

Asciidoctor::Extensions.register do
  preprocessor do
    process do |document, reader|
      document.sourcemap = true
      reader
    end
  end

  tree_processor do
    process do |document|
      docfile = document.attr('docfile')
      document.find_by { |node| node.source_location }.each do |node|
        loc = node.source_location
        # skip content from included files, their lines are not in the buffer
        next if loc.file && docfile && File.expand_path(loc.file, document.base_dir) != docfile
        node.add_role("srcline-#{loc.lineno}")
      end
      document
    end
  end
end
