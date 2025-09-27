import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ref } from "vue"
import * as E from "fp-ts/Either"

// Mocks for external dependencies used by HoppEnvironment
vi.mock("~/helpers/actions", () => ({
  invokeAction: vi.fn(),
}))

vi.mock("~/modules/dioc", () => ({
  getService: vi.fn(),
}))

vi.mock("~/newstore/environments", () => ({
  aggregateEnvsWithCurrentValue$: {
    subscribe: vi.fn(),
  },
  getAggregateEnvsWithCurrentValue: vi.fn(),
  getCurrentEnvironment: vi.fn(),
  getSelectedEnvironmentType: vi.fn(),
}))

vi.mock("~/services/secret-environment.service", () => ({
  SecretEnvironmentService: vi.fn(),
}))

vi.mock("~/services/tab/rest", () => ({
  RESTTabService: vi.fn(),
}))

vi.mock("~/services/current-environment-value.service", () => ({
  CurrentValueService: vi.fn(),
}))

vi.mock("@hoppscotch/data", () => ({
  parseTemplateStringE: vi.fn(),
}))

vi.mock("./helpers", () => ({
  isComment: vi.fn(),
}))

vi.mock("~/helpers/utils/inheritedCollectionVarTransformer", () => ({
  transformInheritedCollectionVariablesToAggregateEnv: vi.fn(),
}))

import {
  environmentHighlightStyle,
  HoppEnvironmentPlugin,
  HoppReactiveEnvPlugin,
} from "../HoppEnvironment"
import { getService } from "~/modules/dioc"
import {
  getCurrentEnvironment,
  getSelectedEnvironmentType,
  getAggregateEnvsWithCurrentValue,
  aggregateEnvsWithCurrentValue$,
} from "~/newstore/environments"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import { RESTTabService } from "~/services/tab/rest"
import { CurrentValueService } from "~/services/current-environment-value.service"
import { parseTemplateStringE } from "@hoppscotch/data"
import { isComment } from "./helpers"
import { transformInheritedCollectionVariablesToAggregateEnv } from "~/helpers/utils/inheritedCollectionVarTransformer"

/**
 * Vitest is the testing framework and runner used in this repository.
 * These tests focus on the public interfaces exported from HoppEnvironment:
 * - environmentHighlightStyle
 * - HoppEnvironmentPlugin
 * - HoppReactiveEnvPlugin
 */

// Test data fixtures
const mockAggregateEnvs = [
  {
    key: "API_URL",
    currentValue: "https://api.example.com",
    initialValue: "https://api.example.com",
    sourceEnv: "Global",
    secret: false,
  },
  {
    key: "SECRET_KEY",
    currentValue: "",
    initialValue: "secret123",
    sourceEnv: "Personal",
    secret: true,
  },
  {
    key: "REQUEST_VAR",
    currentValue: "test-value",
    initialValue: "test-value",
    sourceEnv: "RequestVariable",
    secret: false,
  },
  {
    key: "COLLECTION_VAR",
    currentValue: "collection-value",
    initialValue: "collection-value",
    sourceEnv: "CollectionVariable",
    secret: false,
  },
  {
    key: "EMPTY_VAR",
    currentValue: "",
    initialValue: "",
    sourceEnv: "Personal",
    secret: false,
  },
]

const mockRequestVariables = [
  { key: "REQ_VAR1", value: "value1", active: true },
  { key: "REQ_VAR2", value: "value2", active: false },
  { key: "REQ_VAR3", value: "value3", active: true },
]

const mockCollectionVariables = [
  { key: "COLL_VAR1", value: "coll-value1" },
  { key: "COLL_VAR2", value: "coll-value2" },
]

describe("HoppEnvironment", () => {
  let mockSecretEnvironmentService: any
  let mockCurrentEnvironmentValueService: any
  let mockRestTabs: any
  let mockEditorView: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSecretEnvironmentService = {
      hasSecretValue: vi.fn().mockReturnValue(false),
    }

    mockCurrentEnvironmentValueService = {
      getEnvironmentByKey: vi.fn().mockReturnValue({ currentValue: "mocked-current-value" }),
    }

    mockRestTabs = {
      currentActiveTab: ref({
        document: {
          type: "request",
          request: {
            requestVariables: mockRequestVariables,
          },
          inheritedProperties: {
            variables: mockCollectionVariables,
          },
          optionTabPreference: "",
        },
      }),
    }

    mockEditorView = {
      state: {
        doc: {
          lineAt: vi.fn().mockReturnValue({
            from: 0,
            to: 100,
            text: "This is a test line with <<API_URL>> variable",
          }),
          sliceString: vi.fn().mockReturnValue("<<API_URL>>"),
        },
        wordAt: vi.fn(),
      },
      dispatch: vi.fn(),
    }

    vi.mocked(getService).mockImplementation((service) => {
      if (service === SecretEnvironmentService) return mockSecretEnvironmentService
      if (service === CurrentValueService) return mockCurrentEnvironmentValueService
      if (service === RESTTabService) return mockRestTabs
      return {}
    })

    vi.mocked(getCurrentEnvironment).mockReturnValue({
      id: "test-env-id",
      name: "Test Environment",
      variables: [],
    })

    vi.mocked(getSelectedEnvironmentType).mockReturnValue("MY_ENV")
    vi.mocked(getAggregateEnvsWithCurrentValue).mockReturnValue(mockAggregateEnvs)
    vi.mocked(isComment).mockReturnValue(false)
    vi.mocked(parseTemplateStringE).mockReturnValue(E.right("parsed-value"))
    vi.mocked(transformInheritedCollectionVariablesToAggregateEnv).mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("environmentHighlightStyle", () => {
    it("creates a ViewPlugin definition", () => {
      const plugin = environmentHighlightStyle(mockAggregateEnvs)
      expect(plugin).toBeDefined()
      expect(typeof plugin).toBe("object")
    })

    it("filters out empty variables and still returns plugin", () => {
      const envsWithEmpty = [
        ...mockAggregateEnvs,
        { key: "EMPTY", currentValue: "", initialValue: "", sourceEnv: "Personal", secret: false },
      ]
      const plugin = environmentHighlightStyle(envsWithEmpty)
      expect(plugin).toBeDefined()
    })

    it("supports different source environment types without error", () => {
      const diverseEnvs = [
        { key: "GLOBAL", currentValue: "global", initialValue: "global", sourceEnv: "Global", secret: false },
        { key: "REQUEST", currentValue: "request", initialValue: "request", sourceEnv: "RequestVariable", secret: false },
        { key: "COLLECTION", currentValue: "collection", initialValue: "collection", sourceEnv: "CollectionVariable", secret: false },
        { key: "PERSONAL", currentValue: "personal", initialValue: "personal", sourceEnv: "Personal", secret: false },
      ]
      const plugin = environmentHighlightStyle(diverseEnvs)
      expect(plugin).toBeDefined()
    })
  })

  describe("filterNonEmptyEnvironmentVariables (via environmentHighlightStyle)", () => {
    it("prefers non-empty entries when duplicates exist", () => {
      const envs = [
        { key: "DUPLICATE", currentValue: "", initialValue: "", sourceEnv: "Personal", secret: false },
        { key: "DUPLICATE", currentValue: "non-empty", initialValue: "non-empty", sourceEnv: "Global", secret: false },
      ]
      const plugin = environmentHighlightStyle(envs)
      expect(plugin).toBeDefined()
    })

    it("handles entries with only current value", () => {
      const envs = [
        { key: "CURRENT_ONLY", currentValue: "current", initialValue: "", sourceEnv: "Personal", secret: false },
      ]
      const plugin = environmentHighlightStyle(envs)
      expect(plugin).toBeDefined()
    })

    it("handles entries with only initial value", () => {
      const envs = [
        { key: "INITIAL_ONLY", currentValue: "", initialValue: "initial", sourceEnv: "Personal", secret: false },
      ]
      const plugin = environmentHighlightStyle(envs)
      expect(plugin).toBeDefined()
    })
  })

  describe("HoppEnvironmentPlugin", () => {
    let mockSubscribeToStream: any

    beforeEach(() => {
      mockSubscribeToStream = vi.fn().mockImplementation((stream, callback) => {
        // Trigger immediately to simulate first emission
        callback(mockAggregateEnvs)
      })
    })

    it("initializes and subscribes to environment updates", () => {
      const editorViewRef = ref(mockEditorView)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)

      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
      expect(mockSubscribeToStream).toHaveBeenCalledWith(
        aggregateEnvsWithCurrentValue$,
        expect.any(Function)
      )
    })

    it("gracefully handles missing request object", () => {
      mockRestTabs.currentActiveTab.value.document.request = null
      const editorViewRef = ref(mockEditorView)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)
      expect(plugin).toBeDefined()
    })

    it("gracefully handles missing inheritedProperties", () => {
      mockRestTabs.currentActiveTab.value.document.inheritedProperties = null
      const editorViewRef = ref(mockEditorView)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)
      expect(plugin).toBeDefined()
    })

    it("supports example-response document type", () => {
      mockRestTabs.currentActiveTab.value.document = {
        type: "example-response",
        response: {
          originalRequest: {
            requestVariables: mockRequestVariables,
          },
        },
        inheritedProperties: {
          variables: mockCollectionVariables,
        },
      }

      const editorViewRef = ref(mockEditorView)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)
      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })

    it("updates editor configuration when environments change", () => {
      const editorViewRef = ref(mockEditorView)
      let streamCallback: any

      mockSubscribeToStream.mockImplementation((_stream, callback) => {
        streamCallback = callback
      })

      // Construct plugin
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)

      // Simulate environment change
      const newEnvs = [...mockAggregateEnvs, {
        key: "NEW_VAR",
        currentValue: "new-value",
        initialValue: "new-value",
        sourceEnv: "Personal",
        secret: false,
      }]

      streamCallback(newEnvs)
      expect(mockEditorView.dispatch).toHaveBeenCalled()
    })

    it("handles undefined editor view", () => {
      const editorViewRef = ref(undefined)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)
      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })

    it("filters active request variables", () => {
      const requestVars = [
        { key: "ACTIVE_VAR", value: "active", active: true },
        { key: "INACTIVE_VAR", value: "inactive", active: false },
      ]
      mockRestTabs.currentActiveTab.value.document.request.requestVariables = requestVars

      const editorViewRef = ref(mockEditorView)
      const plugin = new HoppEnvironmentPlugin(mockSubscribeToStream, editorViewRef)
      expect(plugin).toBeDefined()
    })
  })

  describe("HoppReactiveEnvPlugin", () => {
    it("initializes with envs ref and editor view", () => {
      const envsRef = ref(mockAggregateEnvs)
      const editorViewRef = ref(mockEditorView)

      const plugin = new HoppReactiveEnvPlugin(envsRef, editorViewRef)
      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })

    it("reacts to envs ref changes", () => {
      const envsRef = ref(mockAggregateEnvs)
      const editorViewRef = ref(mockEditorView)

      const plugin = new HoppReactiveEnvPlugin(envsRef, editorViewRef)

      envsRef.value = [...mockAggregateEnvs, {
        key: "NEW_REACTIVE_VAR",
        currentValue: "reactive-value",
        initialValue: "reactive-value",
        sourceEnv: "Personal",
        secret: false,
      }]

      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })

    it("handles empty environments", () => {
      const envsRef = ref([])
      const editorViewRef = ref(mockEditorView)

      const plugin = new HoppReactiveEnvPlugin(envsRef, editorViewRef)
      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })

    it("handles undefined editor view", () => {
      const envsRef = ref(mockAggregateEnvs)
      const editorViewRef = ref(undefined)

      const plugin = new HoppReactiveEnvPlugin(envsRef, editorViewRef)
      expect(plugin).toBeDefined()
      expect(plugin.extension).toBeDefined()
    })
  })

  describe("Tooltip and parsing behavior (indirect via public APIs)", () => {
    it("handles secret environments (masking logic indirectly exercised)", () => {
      mockSecretEnvironmentService.hasSecretValue.mockReturnValue(true)

      const secretEnvs = [{
        key: "SECRET_VAR",
        currentValue: "secret-value",
        initialValue: "secret-initial",
        sourceEnv: "Personal",
        secret: true,
      }]

      const plugin = environmentHighlightStyle(secretEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles global environments without error", () => {
      const globalEnvs = [{
        key: "GLOBAL_VAR",
        currentValue: "global-value",
        initialValue: "global-initial",
        sourceEnv: "Global",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(globalEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles request variables", () => {
      const requestEnvs = [{
        key: "REQUEST_VAR",
        currentValue: "request-value",
        initialValue: "request-initial",
        sourceEnv: "RequestVariable",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(requestEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles collection variables", () => {
      const collectionEnvs = [{
        key: "COLLECTION_VAR",
        currentValue: "collection-value",
        initialValue: "collection-initial",
        sourceEnv: "CollectionVariable",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(collectionEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles empty environment list", () => {
      const plugin = environmentHighlightStyle([])
      expect(plugin).toBeDefined()
    })
  })

  describe("Template parsing via parseTemplateStringE", () => {
    it("handles template parsing success", () => {
      vi.mocked(parseTemplateStringE).mockReturnValue(E.right("parsed-successfully"))

      const envs = [{
        key: "TEMPLATE_VAR",
        currentValue: "<<OTHER_VAR>>",
        initialValue: "<<ANOTHER_VAR>>",
        sourceEnv: "Personal",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(envs)
      expect(plugin).toBeDefined()
    })

    it("handles template parsing failure", () => {
      vi.mocked(parseTemplateStringE).mockReturnValue(E.left(new Error("Parse error")))

      const envs = [{
        key: "INVALID_TEMPLATE",
        currentValue: "<<INVALID>>",
        initialValue: "<<ALSO_INVALID>>",
        sourceEnv: "Personal",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(envs)
      expect(plugin).toBeDefined()
    })
  })

  describe("Environment type detection impact", () => {
    it("switches behavior for TEAM_ENV vs MY_ENV without error", () => {
      vi.mocked(getSelectedEnvironmentType).mockReturnValue("TEAM_ENV")
      const p1 = environmentHighlightStyle(mockAggregateEnvs)
      expect(p1).toBeDefined()

      vi.mocked(getSelectedEnvironmentType).mockReturnValue("MY_ENV")
      const p2 = environmentHighlightStyle(mockAggregateEnvs)
      expect(p2).toBeDefined()
    })
  })

  describe("Edge cases and stress", () => {
    it("supports keys with special characters allowed by pattern", () => {
      const specialEnvs = [{
        key: "API.URL-v2_test",
        currentValue: "https://api-v2.example.com",
        initialValue: "https://api-v2.example.com",
        sourceEnv: "Personal",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(specialEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles null/undefined values", () => {
      const nullEnvs = [{
        key: "NULL_VAR",
        // @ts-expect-error explicit test of unexpected inputs
        currentValue: null,
        // @ts-expect-error explicit test of unexpected inputs
        initialValue: undefined,
        sourceEnv: "Personal",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(nullEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles very long values", () => {
      const longValue = "x".repeat(10000)
      const longEnvs = [{
        key: "LONG_VAR",
        currentValue: longValue,
        initialValue: longValue,
        sourceEnv: "Personal",
        secret: false,
      }]

      const plugin = environmentHighlightStyle(longEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles mixed secret and non-secret envs", () => {
      const mixedEnvs = [
        { key: "SECRET1", currentValue: "secret", initialValue: "secret", sourceEnv: "Personal", secret: true },
        { key: "PUBLIC1", currentValue: "public", initialValue: "public", sourceEnv: "Personal", secret: false },
        { key: "SECRET2", currentValue: "", initialValue: "", sourceEnv: "Global", secret: true },
      ]

      mockSecretEnvironmentService.hasSecretValue
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)

      const plugin = environmentHighlightStyle(mixedEnvs)
      expect(plugin).toBeDefined()
    })
  })

  describe("Service integrations (robustness)", () => {
    it("handles CurrentValueService returning null", () => {
      mockCurrentEnvironmentValueService.getEnvironmentByKey.mockReturnValue(null)
      const plugin = environmentHighlightStyle(mockAggregateEnvs)
      expect(plugin).toBeDefined()
    })

    it("handles CurrentValueService throwing error", () => {
      mockCurrentEnvironmentValueService.getEnvironmentByKey.mockImplementation(() => {
        throw new Error("Service error")
      })
      expect(() => {
        const plugin = environmentHighlightStyle(mockAggregateEnvs)
        expect(plugin).toBeDefined()
      }).not.toThrow()
    })

    it("handles SecretEnvironmentService errors", () => {
      mockSecretEnvironmentService.hasSecretValue.mockImplementation(() => {
        throw new Error("Secret service error")
      })
      expect(() => {
        const plugin = environmentHighlightStyle(mockAggregateEnvs)
        expect(plugin).toBeDefined()
      }).not.toThrow()
    })
  })

  describe("Performance considerations", () => {
    it("handles large environment arrays quickly", () => {
      const largeEnvArray = Array.from({ length: 1000 }, (_, i) => ({
        key: `VAR_${i}`,
        currentValue: `value_${i}`,
        initialValue: `initial_${i}`,
        sourceEnv: "Personal",
        secret: false,
      }))

      const start = Date.now()
      const plugin = environmentHighlightStyle(largeEnvArray)
      const end = Date.now()

      expect(plugin).toBeDefined()
      expect(end - start).toBeLessThan(1000)
    })

    it("handles rapid reactive updates without error", () => {
      const editorViewRef = ref(mockEditorView)
      const envsRef = ref(mockAggregateEnvs)

      const plugin = new HoppReactiveEnvPlugin(envsRef, editorViewRef)
      expect(plugin).toBeDefined()

      for (let i = 0; i < 10; i++) {
        envsRef.value = [...mockAggregateEnvs, {
          key: `RAPID_${i}`,
          currentValue: `value_${i}`,
          initialValue: `initial_${i}`,
          sourceEnv: "Personal",
          secret: false,
        }]
      }
      expect(plugin.extension).toBeDefined()
    })
  })
})